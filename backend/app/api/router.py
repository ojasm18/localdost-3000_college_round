"""
PATCHWORK API Router — All patch management endpoints.
Provides sites, patches, releases, rollback, and audit for the demo workflow.
"""
import datetime
import json
import uuid
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Body, Query
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.domain import (
    Site, Patch, PatchRevision, PatchOp, Release, ReleaseEntry, AuditLog
)

api_router = APIRouter()


# ─── Helpers ───────────────────────────────────────────────
def _audit(db: Session, site_id: str, action: str, entity_type: str,
           entity_id: str, reason: str = None, before: dict = None, after: dict = None):
    """Append an audit event inside the current transaction."""
    log = AuditLog(
        site_id=site_id,
        actor_id="demo_user",
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        reason=reason,
        before_state=json.dumps(before) if before else None,
        after_state=json.dumps(after) if after else None,
        correlation_id=str(uuid.uuid4()),
    )
    db.add(log)


def _ensure_default_site(db: Session):
    """Create the default MediCare+ site if it doesn't exist."""
    site = db.query(Site).filter(Site.slug == "medicare_plus_demo").first()
    if not site:
        site = Site(slug="medicare_plus_demo", name="MediCare+ Demo")
        db.add(site)
        db.commit()
        db.refresh(site)
    return site


def _site_summary(site: Site, db: Session):
    """Build a site summary dict."""
    patches = db.query(Patch).filter(Patch.site_id == site.id, Patch.archived == False).all()
    active_count = 0
    review_due = 0
    for p in patches:
        rev = db.query(PatchRevision).filter(PatchRevision.id == p.latest_revision_id).first()
        if rev:
            if rev.review_state == "approved":
                active_count += 1
            elif rev.review_state in ("draft", "in_review"):
                review_due += 1

    releases = db.query(Release).filter(Release.site_id == site.id).count()

    return {
        "id": site.id,
        "slug": site.slug,
        "name": site.name,
        "active_release_id": site.active_release_id,
        "deployment_generation": site.deployment_generation,
        "counts": {
            "total_patches": len(patches),
            "active_patches": active_count,
            "review_due": review_due,
            "total_releases": releases,
        }
    }


# ─── Sites ─────────────────────────────────────────────────
@api_router.get("/sites")
def get_sites(db: Session = Depends(get_db)):
    _ensure_default_site(db)
    sites = db.query(Site).all()
    return {"items": [{"id": s.id, "slug": s.slug, "name": s.name} for s in sites]}


@api_router.get("/sites/{site_id}")
def get_site(site_id: str, db: Session = Depends(get_db)):
    site = db.query(Site).filter(Site.slug == site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    return _site_summary(site, db)


@api_router.get("/sites/{site_id}/summary")
def get_site_summary(site_id: str, db: Session = Depends(get_db)):
    site = db.query(Site).filter(Site.slug == site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    return _site_summary(site, db)


# ─── Patches ───────────────────────────────────────────────
@api_router.post("/patches", status_code=201)
def create_patch(
    site_id: str = Query(...),
    payload: dict = Body(...),
    db: Session = Depends(get_db)
):
    site = db.query(Site).filter(Site.slug == site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    ops_data = payload.get("ops", [])
    if not ops_data:
        raise HTTPException(status_code=422, detail="At least one operation is required")

    # Create immutable revision
    content_hash = str(uuid.uuid4())
    rev = PatchRevision(
        content_hash=content_hash,
        revision_no=1,
        review_state="approved",  # Auto-approve for demo
    )
    db.add(rev)
    db.flush()

    # Create operations
    for idx, op in enumerate(ops_data):
        po = PatchOp(
            patch_revision_id=rev.id,
            position=idx,
            change_type=op.get("change_type", "style"),
            target_signature=op.get("target_signature", {}),
            precondition=op.get("precondition"),
            new_value=op.get("new_value", {}),
        )
        db.add(po)

    # Create patch
    patch = Patch(
        site_id=site.id,
        title=payload.get("title", "New Patch"),
        rationale=payload.get("rationale", ""),
        latest_revision_id=rev.id,
    )
    db.add(patch)
    db.flush()

    # Link revision to patch
    rev.patch_id = patch.id

    # Audit
    _audit(db, site.id, "patch.created", "patch", patch.id,
           after={"title": patch.title, "ops_count": len(ops_data)})

    db.commit()
    db.refresh(patch)

    return {
        "id": patch.id,
        "title": patch.title,
        "rationale": patch.rationale,
        "latest_revision_id": patch.latest_revision_id,
        "review_state": "approved",
    }


@api_router.get("/patches")
def get_patches(site_id: str = Query(...), db: Session = Depends(get_db)):
    site = db.query(Site).filter(Site.slug == site_id).first()
    if not site:
        return {"items": []}
    patches = db.query(Patch).filter(
        Patch.site_id == site.id,
        Patch.archived == False
    ).order_by(Patch.created_at.desc()).all()

    results = []
    for p in patches:
        rev = db.query(PatchRevision).filter(PatchRevision.id == p.latest_revision_id).first()
        ops = []
        if rev:
            for op in rev.ops:
                ops.append({
                    "change_type": op.change_type,
                    "target_signature": op.target_signature,
                    "new_value": op.new_value,
                })

        results.append({
            "id": p.id,
            "title": p.title,
            "rationale": p.rationale,
            "latest_revision_id": p.latest_revision_id,
            "review_state": rev.review_state if rev else "draft",
            "ops": ops,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        })
    return {"items": results}


@api_router.delete("/patches/{patch_id}")
def delete_patch(patch_id: str, db: Session = Depends(get_db)):
    patch = db.query(Patch).filter(Patch.id == patch_id).first()
    if not patch:
        raise HTTPException(status_code=404, detail="Patch not found")
    patch.archived = True
    _audit(db, patch.site_id, "patch.archived", "patch", patch.id)
    db.commit()
    return {"status": "archived"}


@api_router.post("/patches/{patch_id}/approve")
def approve_patch(patch_id: str, db: Session = Depends(get_db)):
    patch = db.query(Patch).filter(Patch.id == patch_id).first()
    if not patch:
        raise HTTPException(status_code=404)
    rev = db.query(PatchRevision).filter(PatchRevision.id == patch.latest_revision_id).first()
    if rev:
        rev.review_state = "approved"
        _audit(db, patch.site_id, "review.approved", "patch_revision", rev.id)
        db.commit()
    return {"status": "approved"}


# ─── Releases ──────────────────────────────────────────────
@api_router.post("/releases", status_code=201)
def create_release(
    site_id: str = Query(...),
    payload: dict = Body(...),
    db: Session = Depends(get_db)
):
    site = db.query(Site).filter(Site.slug == site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    # Get all approved patches
    patches = db.query(Patch).filter(
        Patch.site_id == site.id,
        Patch.archived == False
    ).all()

    approved_entries = []
    for p in patches:
        rev = db.query(PatchRevision).filter(PatchRevision.id == p.latest_revision_id).first()
        if rev and rev.review_state == "approved":
            approved_entries.append((p, rev))

    if not approved_entries:
        raise HTTPException(status_code=422, detail="No approved patches to release")

    # Create release
    version_no = db.query(Release).filter(Release.site_id == site.id).count() + 1
    manifest_hash = str(uuid.uuid4())

    rel = Release(
        site_id=site.id,
        version_no=version_no,
        manifest_hash=manifest_hash,
        verification_status="passed",
    )
    db.add(rel)
    db.flush()

    # Create release entries
    for pos, (p, rev) in enumerate(approved_entries):
        entry = ReleaseEntry(
            release_id=rel.id,
            position=pos,
            patch_id=p.id,
            patch_revision_id=rev.id,
        )
        db.add(entry)

    mode = payload.get("mode", "candidate")
    if mode == "publish":
        old_release = site.active_release_id
        site.active_release_id = rel.id
        site.deployment_generation = (site.deployment_generation or 0) + 1
        _audit(db, site.id, "deployment.published", "release", rel.id,
               reason=payload.get("reason", "Demo deployment"),
               before={"active_release_id": old_release},
               after={"active_release_id": rel.id, "generation": site.deployment_generation})
    else:
        _audit(db, site.id, "release.frozen", "release", rel.id,
               after={"version_no": version_no, "patches": len(approved_entries)})

    db.commit()

    return {
        "id": rel.id,
        "version_no": version_no,
        "manifest_hash": manifest_hash,
        "patches_count": len(approved_entries),
        "is_active": mode == "publish",
        "deployment_generation": site.deployment_generation,
    }


@api_router.get("/releases")
def get_releases(site_id: str = Query(...), db: Session = Depends(get_db)):
    site = db.query(Site).filter(Site.slug == site_id).first()
    if not site:
        return {"items": []}

    rels = db.query(Release).filter(Release.site_id == site.id).order_by(Release.created_at.desc()).all()
    out = []
    for r in rels:
        entries = db.query(ReleaseEntry).filter(ReleaseEntry.release_id == r.id).order_by(ReleaseEntry.position).all()
        patches_info = []
        for e in entries:
            rev = db.query(PatchRevision).filter(PatchRevision.id == e.patch_revision_id).first()
            patch = db.query(Patch).filter(Patch.id == e.patch_id).first() if e.patch_id else None
            patches_info.append({
                "patch_id": e.patch_id,
                "patch_title": patch.title if patch else "Unknown",
                "revision_id": e.patch_revision_id,
                "position": e.position,
            })

        out.append({
            "id": r.id,
            "version_no": r.version_no,
            "manifest_hash": r.manifest_hash,
            "is_active": site.active_release_id == r.id,
            "verification_status": r.verification_status,
            "patches_count": len(entries),
            "patches": patches_info,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })
    return {"items": out}


@api_router.post("/releases/{release_id}/rollback")
def rollback_release(release_id: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    """Rollback to a specific earlier release."""
    target_release_id = payload.get("target_release_id")
    reason = payload.get("reason", "Rollback requested")

    # Find current release context
    release = db.query(Release).filter(Release.id == release_id).first()
    if not release:
        raise HTTPException(status_code=404, detail="Release not found")

    site = db.query(Site).filter(Site.id == release.site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    # If target specified, validate it exists
    if target_release_id:
        target = db.query(Release).filter(
            Release.id == target_release_id,
            Release.site_id == site.id
        ).first()
        if not target:
            raise HTTPException(status_code=404, detail="Target release not found")
    else:
        # Roll back to the previous release
        target = db.query(Release).filter(
            Release.site_id == site.id,
            Release.id != site.active_release_id
        ).order_by(Release.created_at.desc()).first()
        if not target:
            # No previous release, deactivate
            old_release = site.active_release_id
            site.active_release_id = None
            site.deployment_generation = (site.deployment_generation or 0) + 1
            _audit(db, site.id, "deployment.rolled_back", "release", release_id,
                   reason=reason,
                   before={"active_release_id": old_release},
                   after={"active_release_id": None})
            db.commit()
            return {"status": "rolled_back", "active_release_id": None}
        target_release_id = target.id

    old_release = site.active_release_id
    site.active_release_id = target_release_id
    site.deployment_generation = (site.deployment_generation or 0) + 1
    _audit(db, site.id, "deployment.rolled_back", "release", release_id,
           reason=reason,
           before={"active_release_id": old_release},
           after={"active_release_id": target_release_id, "generation": site.deployment_generation})

    db.commit()

    return {
        "status": "rolled_back",
        "active_release_id": target_release_id,
        "deployment_generation": site.deployment_generation,
    }


# ─── Public Runtime Endpoint ──────────────────────────────
@api_router.get("/sites/{site_id}/active-patches")
def active_patches(site_id: str, db: Session = Depends(get_db)):
    """Public endpoint for patchwork.js runtime to fetch the active manifest."""
    site = db.query(Site).filter(Site.slug == site_id).first()
    if not site or not site.active_release_id:
        return {"schema_version": "1.0", "site_id": site_id, "entries": []}

    rel = db.query(Release).filter(Release.id == site.active_release_id).first()
    if not rel:
        return {"schema_version": "1.0", "site_id": site_id, "entries": []}

    entries_db = db.query(ReleaseEntry).filter(
        ReleaseEntry.release_id == rel.id
    ).order_by(ReleaseEntry.position).all()

    entries = []
    for entry in entries_db:
        rev = db.query(PatchRevision).filter(PatchRevision.id == entry.patch_revision_id).first()
        if not rev:
            continue
        ops = []
        for op in rev.ops:
            ops.append({
                "change_type": op.change_type,
                "target_signature": op.target_signature,
                "new_value": op.new_value,
            })
        patch = db.query(Patch).filter(Patch.id == entry.patch_id).first()
        entries.append({
            "patch_id": entry.patch_id,
            "patch_title": patch.title if patch else "Unknown",
            "ops": ops,
        })

    return {
        "schema_version": "1.0",
        "site_id": site.slug,
        "release_id": rel.id,
        "deployment_generation": site.deployment_generation,
        "manifest_hash": rel.manifest_hash,
        "entries": entries,
    }


# ─── Runtime Telemetry ────────────────────────────────────
@api_router.post("/runtime/report")
def runtime_report(payload: dict = Body(...)):
    """Accept bounded runtime diagnostic reports (untrusted)."""
    # For demo: just acknowledge
    return {"accepted": True}


# ─── Audit Trail ──────────────────────────────────────────
@api_router.get("/audit")
def get_audit(
    site_id: str = Query(None),
    limit: int = Query(50, le=100),
    db: Session = Depends(get_db)
):
    query = db.query(AuditLog)
    if site_id:
        site = db.query(Site).filter(Site.slug == site_id).first()
        if site:
            query = query.filter(AuditLog.site_id == site.id)
    events = query.order_by(AuditLog.created_at.desc()).limit(limit).all()

    return {
        "items": [{
            "id": e.id,
            "action": e.action,
            "entity_type": e.entity_type,
            "entity_id": e.entity_id,
            "actor_id": e.actor_id,
            "reason": e.reason,
            "before": json.loads(e.before_state) if e.before_state else None,
            "after": json.loads(e.after_state) if e.after_state else None,
            "correlation_id": e.correlation_id,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        } for e in events]
    }


# ─── Reset (Demo utility) ─────────────────────────────────
@api_router.post("/reset")
def reset_demo(db: Session = Depends(get_db)):
    """Reset all demo data for a clean presentation."""
    db.query(AuditLog).delete()
    db.query(ReleaseEntry).delete()
    db.query(Release).delete()
    db.query(PatchOp).delete()
    db.query(PatchRevision).delete()
    db.query(Patch).delete()

    # Reset site state
    sites = db.query(Site).all()
    for s in sites:
        s.active_release_id = None
        s.deployment_generation = 0

    _audit(db, sites[0].id if sites else None, "system.reset", "system", "all",
           reason="Demo reset")
    db.commit()
    return {"status": "reset_complete"}
