import React from "react";
import QRCode from "qrcode";
import * as XLSX from "xlsx";

type Point = { x: number; y: number };
type DragPointKey = "name" | "cert_id" | "cert_qr";

type Participant = {
    name: string;
    email: string;
};

type TextLayerConfig = {
    coords: Point;
    font: string;
    font_size: number;
    color: string;
};

type QrLayerConfig = {
    size: number;
    color: string;
    coords: Point;
};

type CertificateTemplate = {
    image: string;
    image_size: {
        height: number;
        width: number;
    };
    event_name: string;
    type: string;
    participants: Participant[];
    name: TextLayerConfig;
    cert_id: TextLayerConfig;
    cert_qr: QrLayerConfig;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const initialTemplate: CertificateTemplate = {
    image: "",
    image_size: {
        height: 0,
        width: 0,
    },
    event_name: "",
    type: "participation",
    participants: [{ name: "", email: "" }],
    name: {
        coords: { x: 0, y: 0 },
        font: "Arial",
        font_size: 42,
        color: "#000000",
    },
    cert_id: {
        coords: { x: 0, y: 0 },
        font: "Arial",
        font_size: 24,
        color: "#000000",
    },
    cert_qr: {
        size: 128,
        color: "#000000",
        coords: { x: 0, y: 0 },
    },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="space-y-2.5 rounded-xl border border-slate-200/90 bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.05),0_0_0_1px_rgba(66,133,244,0.04)] transition-shadow hover:shadow-[0_4px_14px_rgba(66,133,244,0.12)]">
            <h4 className="border-b border-slate-100 pb-1 text-sm font-semibold uppercase tracking-wide text-slate-900">{title}</h4>
            {children}
        </section>
    );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
    return <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-600">{children}</label>;
}

function CompactField({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <FieldLabel>{label}</FieldLabel>
            {children}
        </div>
    );
}

export default function GenerateCertificatePage() {
    const previewViewportRef = React.useRef<HTMLDivElement>(null);
    const canvasRef = React.useRef<HTMLCanvasElement>(null);

    const [template, setTemplate] = React.useState<CertificateTemplate>(initialTemplate);
    const [draggingPoint, setDraggingPoint] = React.useState<DragPointKey | null>(null);
    const [viewportSize, setViewportSize] = React.useState({ width: 0, height: 0 });
    const [qrPreviewSrc, setQrPreviewSrc] = React.useState("");

    React.useEffect(() => {
        const viewport = previewViewportRef.current;
        if (!viewport) return;

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry) return;

            setViewportSize({
                width: entry.contentRect.width,
                height: entry.contentRect.height,
            });
        });

        observer.observe(viewport);
        return () => observer.disconnect();
    }, []);

    const previewScale = React.useMemo(() => {
        if (!template.image_size.width || !template.image_size.height || !viewportSize.width || !viewportSize.height) {
            return 1;
        }

        const padding = 32;
        const availableWidth = Math.max(viewportSize.width - padding, 1);
        const availableHeight = Math.max(viewportSize.height - padding, 1);
        return Math.min(availableWidth / template.image_size.width, availableHeight / template.image_size.height, 1);
    }, [template.image_size.height, template.image_size.width, viewportSize.height, viewportSize.width]);

    const previewWidth = template.image_size.width * previewScale;
    const previewHeight = template.image_size.height * previewScale;

    const updateTextLayer = (key: "name" | "cert_id", patch: Partial<TextLayerConfig>) => {
        setTemplate((previous) => ({
            ...previous,
            [key]: {
                ...previous[key],
                ...patch,
            },
        }));
    };

    const updateQrLayer = (patch: Partial<QrLayerConfig>) => {
        setTemplate((previous) => ({
            ...previous,
            cert_qr: {
                ...previous.cert_qr,
                ...patch,
            },
        }));
    };

    const setParticipantsFile = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (loadEvent) => {
            const data = loadEvent.target?.result;
            if (!(data instanceof ArrayBuffer)) return;

            const workbook = XLSX.read(data, { type: "array" });
            const firstSheetName = workbook.SheetNames[0];
            if (!firstSheetName) return;

            const sheet = workbook.Sheets[firstSheetName];
            const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1, blankrows: false });

            const participants = rows
                .map((row) => ({
                    name: String(row[0] ?? "").trim(),
                    email: String(row[1] ?? "").trim(),
                }))
                .filter((participant) => participant.name || participant.email);

            setTemplate((previous) => ({
                ...previous,
                participants: participants.length > 0 ? participants : previous.participants,
            }));
        };

        reader.readAsArrayBuffer(file);
    };

    const setImage = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (loadEvent) => {
            const imageBase64 = loadEvent.target?.result as string;
            const image = new Image();

            image.onload = () => {
                const canvas = canvasRef.current;
                if (!canvas) return;

                const context = canvas.getContext("2d");
                if (!context) return;

                canvas.width = image.naturalWidth;
                canvas.height = image.naturalHeight;
                context.drawImage(image, 0, 0);

                setTemplate((previous) => ({
                    ...previous,
                    image: imageBase64,
                    image_size: {
                        width: image.naturalWidth,
                        height: image.naturalHeight,
                    },
                    name: {
                        ...previous.name,
                        coords: { x: image.naturalWidth * 0.5, y: image.naturalHeight * 0.25 },
                    },
                    cert_id: {
                        ...previous.cert_id,
                        coords: { x: image.naturalWidth * 0.5, y: image.naturalHeight * 0.35 },
                    },
                    cert_qr: {
                        ...previous.cert_qr,
                        coords: { x: image.naturalWidth * 0.82, y: image.naturalHeight * 0.75 },
                    },
                }));
            };

            image.src = imageBase64;
        };

        reader.readAsDataURL(file);
    };

    React.useEffect(() => {
        if (!draggingPoint || !template.image_size.width || !template.image_size.height) return;

        const onPointerMove = (event: PointerEvent) => {
            const canvas = canvasRef.current;
            if (!canvas) return;

            const rect = canvas.getBoundingClientRect();
            if (!rect.width || !rect.height) return;

            const x = ((event.clientX - rect.left) / rect.width) * template.image_size.width;
            const y = ((event.clientY - rect.top) / rect.height) * template.image_size.height;

            const qrHalf = template.cert_qr.size / 2;
            const minX = draggingPoint === "cert_qr" ? qrHalf : 0;
            const maxX = draggingPoint === "cert_qr" ? template.image_size.width - qrHalf : template.image_size.width;
            const minY = draggingPoint === "cert_qr" ? qrHalf : 0;
            const maxY = draggingPoint === "cert_qr" ? template.image_size.height - qrHalf : template.image_size.height;

            const coords = {
                x: clamp(x, minX, maxX),
                y: clamp(y, minY, maxY),
            };

            setTemplate((previous) => {
                if (draggingPoint === "name") {
                    return { ...previous, name: { ...previous.name, coords } };
                }

                if (draggingPoint === "cert_id") {
                    return { ...previous, cert_id: { ...previous.cert_id, coords } };
                }

                return { ...previous, cert_qr: { ...previous.cert_qr, coords } };
            });
        };

        const onPointerUp = () => setDraggingPoint(null);

        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);
        return () => {
            window.removeEventListener("pointermove", onPointerMove);
            window.removeEventListener("pointerup", onPointerUp);
        };
    }, [draggingPoint, template.cert_qr.size, template.image_size.height, template.image_size.width]);

    React.useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext("2d");
        if (!context) return;

        context.fillStyle = "#dbeafe";
        context.fillRect(0, 0, canvas.width, canvas.height);
    }, []);

    React.useEffect(() => {
        const qrValue = JSON.stringify({
            event_name: template.event_name || "Sample Event",
            cert_id: "CERT-2026-0001",
            email: template.participants[0]?.email || "participant@example.com",
        });

        QRCode.toDataURL(qrValue, {
            margin: 0,
            width: 256,
            color: {
                dark: template.cert_qr.color,
                light: "#FFFFFF",
            },
        })
            .then(setQrPreviewSrc)
            .catch(() => setQrPreviewSrc(""));
    }, [template.cert_qr.color, template.event_name, template.participants]);

    return (
        <div className="flex h-dvh w-full overflow-hidden bg-[radial-gradient(circle_at_top_left,#e8f0fe_0%,#f8f9fa_34%,#f8f9fa_100%)] text-slate-800 antialiased">
            <aside className="gdg-scroll w-88 shrink-0 overflow-auto border-r border-slate-200 bg-white/95 p-3 shadow-sm scroll-smooth">
                <div className="mb-3 flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#4285F4]" />
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#EA4335]" />
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#FBBC05]" />
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#34A853]" />
                    <p className="ml-1 text-sm font-semibold uppercase tracking-wide">Certificate Builder</p>
                </div>

                <div className="space-y-3.5">
                    <Section title="Certificate">
                        <div>
                            <FieldLabel>Image</FieldLabel>
                            <input className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-xs" type="file" accept="image/*" onChange={setImage} />
                        </div>
                        <div className="grid grid-cols-2 gap-2.5">
                            <div className="col-span-2">
                                <FieldLabel>Event Name</FieldLabel>
                                <input className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-xs" value={template.event_name} onChange={(event) => setTemplate((previous) => ({ ...previous, event_name: event.target.value }))} />
                            </div>
                            <div>
                                <FieldLabel>Type</FieldLabel>
                                <select className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-xs" value={template.type} onChange={(event) => setTemplate((previous) => ({ ...previous, type: event.target.value }))}>
                                    <option value="participation">Participation</option>
                                    <option value="appreciation">Appreciation</option>
                                    <option value="achievement">Achievement</option>
                                    <option value="completion">Completion</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-2.5">
                                <div>
                                    <FieldLabel>Width</FieldLabel>
                                    <input className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-xs" readOnly value={template.image_size.width || 0} />
                                </div>
                                <div>
                                    <FieldLabel>Height</FieldLabel>
                                    <input className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-xs" readOnly value={template.image_size.height || 0} />
                                </div>
                            </div>
                        </div>
                    </Section>

                    <Section title="Participants">
                        <div>
                            <FieldLabel>Excel File</FieldLabel>
                            <input className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-xs" type="file" accept=".xlsx,.xls,.csv" onChange={setParticipantsFile} />
                            <p className="mt-1 text-[11px] text-slate-500">Col 1 = name, Col 2 = email</p>
                        </div>
                        <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1.5 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 text-xs text-slate-600">
                            <span className="font-medium text-slate-800">Count</span>
                            <span>{template.participants.filter((participant) => participant.name || participant.email).length}</span>
                            <span className="font-medium text-slate-800">First</span>
                            <span className="truncate">{template.participants[0]?.name || "-"} {template.participants[0]?.email ? `(${template.participants[0].email})` : ""}</span>
                        </div>
                    </Section>

                    <Section title="Name Layer">
                        <div>
                            <FieldLabel>Font</FieldLabel>
                            <select className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-xs" value={template.name.font} onChange={(event) => updateTextLayer("name", { font: event.target.value })}>
                                <option value="Arial">Arial</option>
                                <option value="Georgia">Georgia</option>
                                <option value="Times New Roman">Times New Roman</option>
                                <option value="Verdana">Verdana</option>
                                <option value="Tahoma">Tahoma</option>
                                <option value="Courier New">Courier New</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-[1fr_auto] gap-2.5 items-end">
                            <CompactField label="Font Size">
                                <input className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-xs" type="number" min={12} max={96} value={template.name.font_size} onChange={(event) => updateTextLayer("name", { font_size: Number(event.target.value) })} />
                            </CompactField>
                            <CompactField label="Color">
                                <input className="h-9 w-12 rounded-md border border-slate-300" type="color" value={template.name.color} onChange={(event) => updateTextLayer("name", { color: event.target.value })} />
                            </CompactField>
                        </div>
                    </Section>

                    <Section title="Certificate ID Layer">
                        <div>
                            <FieldLabel>Font</FieldLabel>
                            <select className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-xs" value={template.cert_id.font} onChange={(event) => updateTextLayer("cert_id", { font: event.target.value })}>
                                <option value="Arial">Arial</option>
                                <option value="Georgia">Georgia</option>
                                <option value="Times New Roman">Times New Roman</option>
                                <option value="Verdana">Verdana</option>
                                <option value="Tahoma">Tahoma</option>
                                <option value="Courier New">Courier New</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-[1fr_auto] gap-2.5 items-end">
                            <CompactField label="Font Size">
                                <input className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-xs" type="number" min={10} max={72} value={template.cert_id.font_size} onChange={(event) => updateTextLayer("cert_id", { font_size: Number(event.target.value) })} />
                            </CompactField>
                            <CompactField label="Color">
                                <input className="h-9 w-12 rounded-md border border-slate-300" type="color" value={template.cert_id.color} onChange={(event) => updateTextLayer("cert_id", { color: event.target.value })} />
                            </CompactField>
                        </div>
                    </Section>

                    <Section title="QR Layer">
                        <div className="grid grid-cols-[1fr_auto] gap-2.5 items-end">
                            <CompactField label="Size">
                                <input className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-xs" type="number" min={16} max={512} value={template.cert_qr.size} onChange={(event) => updateQrLayer({ size: Number(event.target.value) })} />
                            </CompactField>
                            <CompactField label="Color">
                                <input className="h-9 w-12 rounded-md border border-slate-300" type="color" value={template.cert_qr.color} onChange={(event) => updateQrLayer({ color: event.target.value })} />
                            </CompactField>
                        </div>
                    </Section>
                </div>
            </aside>

            <div ref={previewViewportRef} className="gdg-scroll flex-1 overflow-auto p-4 scroll-smooth">
                <div className="inline-block rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
                    <div className="relative" style={{ width: previewWidth || undefined, height: previewHeight || undefined }}>
                        <canvas ref={canvasRef} className="block rounded-md" style={{ width: previewWidth || undefined, height: previewHeight || undefined }} />

                        {template.image_size.width > 0 && template.image_size.height > 0 && (
                            <>
                                <button
                                    type="button"
                                    onPointerDown={() => setDraggingPoint("name")}
                                    className="absolute -translate-x-1/2 -translate-y-1/2 cursor-grab whitespace-nowrap rounded border px-2 py-1 shadow"
                                    style={{
                                        left: `${(template.name.coords.x / template.image_size.width) * 100}%`,
                                        top: `${(template.name.coords.y / template.image_size.height) * 100}%`,
                                        fontFamily: template.name.font,
                                        fontSize: template.name.font_size * previewScale,
                                        color: template.name.color,
                                        borderColor: `${template.name.color}33`,
                                        backgroundColor: `${template.name.color}14`,
                                    }}
                                >
                                    {template.participants[0]?.name || "Participant Name"}
                                </button>

                                <button
                                    type="button"
                                    onPointerDown={() => setDraggingPoint("cert_id")}
                                    className="absolute -translate-x-1/2 -translate-y-1/2 cursor-grab whitespace-nowrap rounded border px-2 py-1 shadow"
                                    style={{
                                        left: `${(template.cert_id.coords.x / template.image_size.width) * 100}%`,
                                        top: `${(template.cert_id.coords.y / template.image_size.height) * 100}%`,
                                        fontFamily: template.cert_id.font,
                                        fontSize: template.cert_id.font_size * previewScale,
                                        color: template.cert_id.color,
                                        borderColor: `${template.cert_id.color}33`,
                                        backgroundColor: `${template.cert_id.color}14`,
                                    }}
                                >
                                    certficate-id-will-be-here
                                </button>

                                <button
                                    type="button"
                                    onPointerDown={() => setDraggingPoint("cert_qr")}
                                    className="absolute -translate-x-1/2 -translate-y-1/2 cursor-grab overflow-hidden rounded border-2 bg-white shadow"
                                    style={{
                                        left: `${(template.cert_qr.coords.x / template.image_size.width) * 100}%`,
                                        top: `${(template.cert_qr.coords.y / template.image_size.height) * 100}%`,
                                        width: `${(template.cert_qr.size / template.image_size.width) * 100}%`,
                                        height: `${(template.cert_qr.size / template.image_size.height) * 100}%`,
                                        borderColor: template.cert_qr.color,
                                    }}
                                >
                                    {qrPreviewSrc ? (
                                        <img src={qrPreviewSrc} alt="QR placeholder" className="h-full w-full object-contain" draggable={false} />
                                    ) : (
                                        <span className="text-[10px] font-semibold text-black">QR</span>
                                    )}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
