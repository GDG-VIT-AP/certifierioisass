const BASE_URL = import.meta.env.VITE_BACKEND_URL ?? "";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
        headers: { "Content-Type": "application/json" },
        ...options,
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
}

export const getCertificate = (certificateId: string) =>
    request(`/cert/${encodeURIComponent(certificateId)}`);

export const generateCertificate = (data: unknown) =>
    request("/generate", { method: "POST", body: JSON.stringify(data) });

export const sendEmails = (payload: { records: unknown[]; event_name: string; cert_base_url: string }) =>
    request<{ success: boolean; sent: number; failed: number; skipped: number }>(
        "/send-emails",
        { method: "POST", body: JSON.stringify(payload) },
    );

export async function uploadToCloudinary(file: File): Promise<string> {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        body: formData,
    });

    if (!res.ok) throw new Error("Cloudinary upload failed");
    const data = await res.json();
    return data.secure_url;
}
