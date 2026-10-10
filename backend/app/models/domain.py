"""
PATCHWORK Domain Models — SQLAlchemy ORM definitions.
"""
from sqlalchemy import Column, String, Integer, Boolean, ForeignKey, DateTime, JSON, Text
from sqlalchemy.orm import relationship
from app.db.database import Base
import uuid
import datetime


def generate_uuid():
    return str(uuid.uuid4())


class Site(Base):
    __tablename__ = "sites"
    id = Column(String, primary_key=True, default=generate_uuid)
    slug = Column(String, unique=True, index=True)
    name = Column(String)
    base_origin = Column(String, nullable=True)
    preview_origin = Column(String, nullable=True)
    allowed_routes = Column(JSON, default=list)
    public_integration_id = Column(String, default=generate_uuid)
    active_release_id = Column(String, nullable=True)
    deployment_generation = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class Patch(Base):
    __tablename__ = "patches"
    id = Column(String, primary_key=True, default=generate_uuid)
    site_id = Column(String, ForeignKey("sites.id"))
    title = Column(String)
    rationale = Column(String, nullable=True)
    latest_revision_id = Column(String, nullable=True)
    archived = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    revisions = relationship("PatchRevision", back_populates="patch", foreign_keys="PatchRevision.patch_id")


class PatchRevision(Base):
    __tablename__ = "patch_revisions"
    id = Column(String, primary_key=True, default=generate_uuid)
    patch_id = Column(String, ForeignKey("patches.id"), nullable=True)
    revision_no = Column(Integer, default=1)
    content_hash = Column(String)
    route_scope = Column(JSON, default=list)
    review_state = Column(String, default="draft")  # draft, in_review, approved, merged
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    ops = relationship("PatchOp", back_populates="revision")
    patch = relationship("Patch", back_populates="revisions", foreign_keys=[patch_id])


class PatchOp(Base):
    __tablename__ = "patch_ops"
    id = Column(String, primary_key=True, default=generate_uuid)
    patch_revision_id = Column(String, ForeignKey("patch_revisions.id"))
    position = Column(Integer, default=0)
    change_type = Column(String)  # style, attr, hide, text, behaviour, move
    target_signature = Column(JSON)
    precondition = Column(JSON, nullable=True)
    old_value = Column(JSON, nullable=True)
    new_value = Column(JSON)
    critical_target = Column(Boolean, default=False)
    revision = relationship("PatchRevision", back_populates="ops")


class Release(Base):
    __tablename__ = "releases"
    id = Column(String, primary_key=True, default=generate_uuid)
    site_id = Column(String, ForeignKey("sites.id"))
    version_no = Column(Integer)
    manifest_hash = Column(String)
    verification_status = Column(String, default="pending")  # pending, passed, failed, inconclusive
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    entries = relationship("ReleaseEntry", back_populates="release", order_by="ReleaseEntry.position")


class ReleaseEntry(Base):
    __tablename__ = "release_entries"
    id = Column(String, primary_key=True, default=generate_uuid)
    release_id = Column(String, ForeignKey("releases.id"))
    position = Column(Integer)
    patch_id = Column(String, nullable=True)
    patch_revision_id = Column(String, ForeignKey("patch_revisions.id"))
    release = relationship("Release", back_populates="entries")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(String, primary_key=True, default=generate_uuid)
    site_id = Column(String, ForeignKey("sites.id"), nullable=True)
    actor_id = Column(String, nullable=True)
    action = Column(String)
    entity_type = Column(String)
    entity_id = Column(String, nullable=True)
    reason = Column(Text, nullable=True)
    before_state = Column(Text, nullable=True)  # JSON string
    after_state = Column(Text, nullable=True)   # JSON string
    correlation_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
