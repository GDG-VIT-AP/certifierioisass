import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import logo from "../assets/GoogleDevelopersLogo.svg";
import { getCertificate } from "../lib/api";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import QRCode from "qrcode";
import certimg from "../assets/gdgimg2.jpeg";

type Point = { x: number; y: number };

type Participant = {
  name: string;
  email?: string;
  reg_no?: string;
};

type TextLayer = {
  coords: Point;
  font: string;
  font_size: number;
  color: string;
};

type QrLayer = {
  coords: Point;
  size: number;
  color: string;
};

type CertificateResponse = {
  image: string;
  image_size: {
    width: number;
    height: number;
  };
  event_name: string;
  type: string;
  participant_name: Participant;
  name: TextLayer;
  cert_id: TextLayer;
  cert_qr: QrLayer;
  certificate_id?: string;
  id?: string;
};

type BackendCertificate = {
  image?: string;
  image_size?: {
    width?: number;
    height?: number;
  };
  event_name?: string;
  type?: string;
  participant?: {
    name?: string;
    cert_id?: string;
  };
  participants?: Participant[];
  participant_name?: {
    name?: string;
    reg_no?: string;
  };
  name?: {
    coords?: Point;
    cords?: Point;
    font?: string;
    font_size?: number;
    font_zise?: number;
    color?: string;
  };
  cert_id?: {
    coords?: Point;
    cords?: Point;
    font?: string;
    font_size?: number;
    font_zise?: number;
    color?: string;
  };
  cert_qr?: {
    coords?: Point;
    cords?: Point;
    size?: number;
    color?: string;
  };
  certificate_id?: string;
  id?: string;
};

const toDataUrl = (image: string) => {
  if (!image) return "";

  const trimmed = image.trim();
  if (trimmed.startsWith("data:image/") || trimmed.startsWith("http")) {
    return trimmed;
  }

  return `data:image/png;base64,${trimmed}`;
};

const normalizeTextLayer = (
  layer: BackendCertificate["name"] | BackendCertificate["cert_id"],
): TextLayer => {
  const coords = layer?.coords ?? layer?.cords ?? { x: 0, y: 0 };

  return {
    coords,
    font: layer?.font ?? "Arial",
    font_size: layer?.font_size ?? layer?.font_zise ?? 24,
    color: layer?.color ?? "#111827",
  };
};

const normalizeCertificate = (rawData: unknown): CertificateResponse => {
  const data = (rawData ?? {}) as BackendCertificate;
  const normalizedWidth =
    typeof data.image_size?.width === "number" && data.image_size.width > 0
      ? data.image_size.width
      : 1200;
  const normalizedHeight =
    typeof data.image_size?.height === "number" && data.image_size.height > 0
      ? data.image_size.height
      : 800;

  const backendCertificateId =
    data.certificate_id ?? data.id ?? data.participant?.cert_id;

  const participantName: Participant = data.participant_name
    ? {
        name: data.participant_name.name ?? "Participant",
        reg_no: data.participant_name.reg_no ?? "",
      }
    : data.participant
      ? {
          name: data.participant.name ?? "Participant",
        }
      : data.participants && data.participants.length > 0
        ? {
            name: data.participants[0].name ?? "Participant",
            email: data.participants[0].email ?? "",
          }
        : {
            name: "Participant",
            reg_no: "",
          };

  return {
    image: toDataUrl(data.image ?? ""),
    image_size: {
      width: normalizedWidth,
      height: normalizedHeight,
    },
    event_name: data.event_name ?? "",
    type: data.type ?? "",
    participant_name: participantName,
    name: normalizeTextLayer(data.name),
    cert_id: normalizeTextLayer(data.cert_id),
    cert_qr: {
      coords: data.cert_qr?.coords ?? data.cert_qr?.cords ?? { x: 80, y: 80 },
      size: data.cert_qr?.size ?? 96,
      color: data.cert_qr?.color ?? "#000000",
    },
    certificate_id: backendCertificateId,
    id: data.id,
  };
};

const VERIFY_BASE_URL =
  import.meta.env.VITE_CERT_VERIFY_BASE_URL ?? "https://facebook.com";

const getDisplayParticipant = (
  participant: Participant | undefined,
): Participant | null => {
  if (!participant) {
    return null;
  }

  if (!participant.name && !participant.email && !participant.reg_no) {
    return null;
  }

  return participant;
};

const getCertificateIdentifier = (
  certificate: CertificateResponse,
  routeCertificateId?: string,
) => {
  const backendId = certificate.certificate_id ?? certificate.id;
  return backendId || routeCertificateId || "";
};

export default function ViewCertificate() {
  const { certificateId } = useParams();

  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [certificate, setCertificate] = useState<CertificateResponse | null>(
    null,
  );
  const [qrImage, setQrImage] = useState("");
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const fetchCertificate = async () => {
      try {
        if (!certificateId) return;
        const data = await getCertificate(certificateId);
        setCertificate(normalizeCertificate(data));
      } catch (err) {
        console.error("Failed to load certificate", err);
      }
    };
    fetchCertificate();
  }, [certificateId]);

  useEffect(() => {
    const generateQrImage = async () => {
      if (!certificate) {
        setQrImage("");
        return;
      }

      try {
        const certIdentifier = getCertificateIdentifier(
          certificate,
          certificateId,
        );
        if (!certIdentifier) {
          setQrImage("");
          return;
        }

        const verifyUrl = `${VERIFY_BASE_URL.replace(/\/$/, "")}/${encodeURIComponent(certIdentifier)}`;

        const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
          width: Math.max(Math.round(certificate.cert_qr.size), 64),
          margin: 1,
          color: {
            dark: certificate.cert_qr.color || "#000000",
            light: "#FFFFFF",
          },
        });

        setQrImage(qrDataUrl);
      } catch (err) {
        console.error("Failed to generate QR image", err);
        setQrImage("");
      }
    };

    generateQrImage();
  }, [certificate, certificateId]);

  useEffect(() => {
    const resize = () => {
      if (!certificate) return;

      const availableWidth = wrapperRef.current
        ? wrapperRef.current.clientWidth
        : window.innerWidth;

      const availableHeight = wrapperRef.current
        ? wrapperRef.current.clientHeight || window.innerHeight
        : window.innerHeight;

      const newScale = Math.min(
        availableWidth / certificate.image_size.width,
        availableHeight / certificate.image_size.height,
        1,
      );

      setScale(newScale);
    };

    window.addEventListener("resize", resize);
    // also observe orientation/initial sizes
    resize();

    return () => window.removeEventListener("resize", resize);
  }, [certificate]);

  const downloadImage = async () => {
    if (!containerRef.current) return;

    try {
      const canvas = await html2canvas(containerRef.current, {
        scale: window.devicePixelRatio * 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        onclone: (doc) => {
          const elements = doc.querySelectorAll("*");
          elements.forEach((element) => {
            const el = element as HTMLElement;
            const style = window.getComputedStyle(el);
            [
              "color",
              "background-color",
              "border-color",
              "text-decoration-color",
            ].forEach((prop) => {
              if (style.getPropertyValue(prop).includes("oklch")) {
                el.style.setProperty(
                  prop,
                  prop === "color" ? "#000000" : "transparent",
                  "important",
                );
              }
            });
          });
        },
      });

      const link = document.createElement("a");
      link.download = "certificate.png";
      link.href = canvas.toDataURL("image/png");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Error downloading image:", err);
    }
  };

  const downloadPDF = async () => {
    if (!containerRef.current) return;

    try {
      const canvas = await html2canvas(containerRef.current, {
        scale: 3,
        useCORS: true,
        onclone: (doc) => {
          const elements = doc.querySelectorAll("*");
          elements.forEach((element) => {
            const el = element as HTMLElement;
            const style = window.getComputedStyle(el);
            [
              "color",
              "background-color",
              "border-color",
              "text-decoration-color",
            ].forEach((prop) => {
              if (style.getPropertyValue(prop).includes("oklch")) {
                el.style.setProperty(
                  prop,
                  prop === "color" ? "#000000" : "transparent",
                  "important",
                );
              }
            });
          });
        },
      });

      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [canvas.width, canvas.height],
      });

      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);

      const displayParticipant = getDisplayParticipant(
        certificate?.participant_name,
      );
      const certIdentifier = certificate
        ? getCertificateIdentifier(certificate, certificateId)
        : "";
      const fileId =
        certIdentifier ||
        displayParticipant?.reg_no ||
        displayParticipant?.email ||
        "certificate";

      pdf.save(`certificate-${fileId}.pdf`);
    } catch (err) {
      console.error("Failed to download PDF:", err);
    }
  };

  if (!certificate) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-xl font-semibold text-blue-600">
          Loading certificate...
        </div>
      </div>
    );
  }

  const { image_size } = certificate;
  const participantName = getDisplayParticipant(certificate.participant_name);
  const certIdentifier = getCertificateIdentifier(certificate, certificateId);

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-green-50 text-gray-800 font-sans">
      {/* Header */}
      <header className="w-full border-b border-gray-200 bg-white/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          {/* Left Section */}
          <div className="flex items-center gap-4">
            <img
              src={logo}
              alt="GDG Logo"
              className="h-10 w-auto hover:scale-105 transition"
            />

            <div className="flex flex-col leading-tight">
              <h1 className="text-xl font-semibold tracking-tight">
                <span className="text-[#4285F4]">Google</span>{" "}
                <span className="text-[#EA4335]">Developers</span>{" "}
                <span className="text-[#FBBC05]">Group</span>
              </h1>

              <span className="text-xs text-gray-500 font-medium">
                OnCampus VIT-AP
              </span>
            </div>
          </div>
        </div>

        {/* Google style color strip */}
        <div className="h-0.75 w-full flex">
          <div className="flex-1 bg-[#4285F4]"></div>
          <div className="flex-1 bg-[#EA4335]"></div>
          <div className="flex-1 bg-[#FBBC05]"></div>
          <div className="flex-1 bg-[#34A853]"></div>
        </div>
      </header>

      {/* Page */}
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-10 px-6 py-10">
        {/* LEFT SIDE — Certificate */}
        <main
          ref={wrapperRef}
          className="flex-1 flex items-center justify-center"
        >
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-4 w-full flex justify-center">
            <div
              ref={containerRef}
              style={{
                position: "relative",
                overflow: "hidden",
                backgroundColor: "#ffffff",
                width: image_size.width * scale,
                height: image_size.height * scale,
                maxWidth: "100%",
                maxHeight: "calc(100vh - 200px)",
              }}
            >
              <img
                src={certificate.image}
                alt="certificate"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                }}
              />

              {/* Participant Name */}
              <div
                style={{
                  position: "absolute",
                  transform: "translate(-50%, -50%)",
                  whiteSpace: "nowrap",
                  left:
                    (certificate.name.coords.x / image_size.width) * 100 + "%",
                  top:
                    (certificate.name.coords.y / image_size.height) * 100 + "%",
                  fontFamily: certificate.name.font,
                  fontSize: certificate.name.font_size * scale,
                  color: certificate.name.color,
                }}
              >
                {participantName?.name ?? "Participant"}
              </div>

              {/* Certificate ID */}
              <div
                style={{
                  position: "absolute",
                  transform: "translate(-50%, -50%)",
                  whiteSpace: "nowrap",
                  left:
                    (certificate.cert_id.coords.x / image_size.width) * 100 +
                    "%",
                  top:
                    (certificate.cert_id.coords.y / image_size.height) * 100 +
                    "%",
                  fontFamily: certificate.cert_id.font,
                  fontSize: certificate.cert_id.font_size * scale,
                  color: certificate.cert_id.color,
                }}
              >
                {certIdentifier ||
                  participantName?.reg_no ||
                  participantName?.email ||
                  "CERTIFICATE"}
              </div>

              {/* QR */}
              {qrImage ? (
                <img
                  src={qrImage}
                  alt="qr"
                  style={{
                    position: "absolute",
                    transform: "translate(-50%, -50%)",
                    left:
                      (certificate.cert_qr.coords.x / image_size.width) * 100 +
                      "%",
                    top:
                      (certificate.cert_qr.coords.y / image_size.height) * 100 +
                      "%",
                    width: certificate.cert_qr.size * scale,
                    height: certificate.cert_qr.size * scale,
                  }}
                />
              ) : null}
            </div>
          </div>
        </main>

        {/* RIGHT PANEL */}
        <aside className="w-full lg:w-96 shrink-0">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 sticky top-8">
            {/* Four Dots */}
            <div className="flex gap-2 mb-4">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-green-600"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
            </div>

            {/* Top Image */}
            <img
              src={certimg}
              alt="Certificate banner"
              className="w-4/5 mx-auto object-contain rounded-lg mb-5"
            />

            <h2 className="text-2xl font-semibold mb-2 text-gray-800">
              Congratulations
            </h2>

            <p className="text-gray-600 text-sm mb-6">
              You've successfully earned a certificate. Download it!
            </p>

            {/* Download Buttons */}
            <div className="flex flex-col gap-4 mb-6">
              {/* Download Image */}
              <button
                onClick={downloadImage}
                className="w-full py-3 rounded-lg text-white font-semibold shadow-md transition hover:shadow-lg hover:scale-[1.02]
                bg-green-600 hover:bg-indigo-700"
              >
                Download Certificate Image
              </button>

              {/* Download PDF */}
              <button
                onClick={downloadPDF}
                className="w-full py-3 rounded-lg text-white font-semibold shadow-md transition hover:shadow-lg hover:scale-[1.02]
                bg-yellow-500 hover:bg-emerald-700"
              >
                Download Certificate PDF
              </button>
            </div>

            <div className="border-t border-gray-200 my-6" />

            {/* Share */}
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-600">
                Connect with us
              </p>

              <div className="flex gap-2">
                {/* LinkedIn */}
                <button
                  onClick={() =>
                    window.open(
                      "https://www.linkedin.com/company/gdgoncampusvitap/posts/?feedView=all",
                      "_blank",
                    )
                  }
                  className="px-3 py-1.5 text-xs rounded-full text-white font-medium shadow-sm transition hover:scale-105
                  bg-blue-600 hover:bg-blue-700"
                >
                  LinkedIn
                </button>

                {/* Instagram */}
                <button
                  onClick={() =>
                    window.open(
                      "https://www.instagram.com/gdgoncampus.vitap?igsh=eXZzdnFvOHd1YW41",
                      "_blank",
                    )
                  }
                  className="px-3 py-1.5 text-xs rounded-full text-white font-medium shadow-sm transition hover:scale-105
                  bg-pink-500 hover:bg-pink-600"
                >
                  Instagram
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
