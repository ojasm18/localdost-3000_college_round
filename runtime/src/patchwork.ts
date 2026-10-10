// patchwork.js runtime

interface TargetSignature {
    css_selector: string;
    text_snippet?: string;
}

interface PatchOp {
    change_type: 'style' | 'behaviour' | 'text' | 'attr' | 'hide' | 'network';
    target_signature: TargetSignature;
    new_value: any;
}

interface Manifest {
    site_id: string;
    entries: {
        ops: PatchOp[]
    }[];
}

class PatchworkRuntime {
    private integrationId: string = '';
    private siteId: string = '';

    constructor() {
        const script = document.currentScript;
        if (script) {
            this.integrationId = script.getAttribute('data-integration') || '';
            this.siteId = script.getAttribute('data-site') || '';
        }

        if (this.siteId) {
            console.log(`[PATCHWORK] Initializing for site: ${this.siteId}`);
            this.fetchManifest();
        }
    }

    async fetchManifest() {
        try {
            const res = await fetch(`http://localhost:8000/api/sites/${this.siteId}/active-patches`);
            if (!res.ok) return;
            const manifest = await res.json();
            this.applyManifest(manifest);
        } catch (e) {
            console.error("[PATCHWORK] Failed to load manifest", e);
        }
    }

    applyManifest(manifest: Manifest) {
        manifest.entries.forEach(entry => {
            entry.ops.forEach(op => {
                this.applyOp(op);
            });
        });
    }

    applyOp(op: PatchOp) {
        // Resolve Target
        const element = this.resolveTarget(op.target_signature);
        if (!element) {
            console.warn("[PATCHWORK] Target not found:", op.target_signature);
            return;
        }

        console.log("[PATCHWORK] Applying op:", op.change_type, "to", element);

        switch (op.change_type) {
            case 'style':
                if (element instanceof HTMLElement) {
                    element.style.setProperty(op.new_value.property, op.new_value.value, 'important');
                }
                break;
            case 'behaviour':
                // For JS injection / Adapter
                try {
                    const func = new Function(op.new_value.code);
                    func();
                } catch(err) {
                    console.error("Behaviour patch failed:", err);
                }
                break;
            case 'network':
                // Network interception
                const originalFetch = window.fetch;
                window.fetch = async (...args) => {
                    const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url || (args[0] as any).toString();
                    if (url.includes(op.target_signature.text_snippet)) {
                        return new Response(JSON.stringify(op.new_value.fallback_response.body), {
                            status: op.new_value.fallback_response.status,
                            headers: { 'Content-Type': 'application/json' }
                        });
                    }
                    return originalFetch(...args);
                };
                break;
        }
    }

    resolveTarget(sig: TargetSignature): Element | null {
        // Simple resolution for MVP
        let elements = Array.from(document.querySelectorAll(sig.css_selector));
        if (sig.text_snippet) {
            elements = elements.filter(el => el.textContent?.includes(sig.text_snippet!));
        }
        return elements[0] || null;
    }
}

// Start runtime
new PatchworkRuntime();
