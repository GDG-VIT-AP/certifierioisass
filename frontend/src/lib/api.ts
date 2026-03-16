import axios from "axios";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL ?? "",
  headers: {
    "Content-Type": "application/json",
  },
});

// export const getCertificate = async (certificateId: string) => {
//   const response = await apiClient.get(`/cert/${certificateId}`);
//   return response.data;
// };

export const getCertificate = async (id: string) => {
  return {
    image:
      "https://www.simplilearn.com/ice9/skillupcertificates/Transformer_Models_and_BERT_Models.png",
    image_size: {
      width: 1200,
      height: 800,
    },
    event_name: "AI Workshop",
    type: "participation",
    participants: [
      {
        name: "Monti",
        email: "monti@example.com",
      },
    ],
    name: {
      coords: { x: 600, y: 300 },
      font: "Georgia",
      font_size: 48,
      color: "#000000",
    },
    cert_id: {
      coords: { x: 600, y: 480 },
      font: "Arial",
      font_size: 24,
      color: "#000000",
    },
    cert_qr: {
      coords: { x: 1050, y: 650 },
      size: 120,
      color: "#000000",
    },
    certificate_id: "CERT-2026-0001",
  };
};

export const generateCertificate = async (data: any) => {
  const response = await apiClient.post("/generate", data);
  return response.data;
};
