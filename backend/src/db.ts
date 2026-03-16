// defining a simple type for our mock database records
export type CertificateRecord = {
    cert_id: string;
    participant_name: string;
    image: string;
    image_size: { width: number; height: number };
    event_name: string;
    type: string;
    name_layer: any;
    cert_id_layer: any;
    cert_qr_layer: any;
};

// This acts as our temporary database
export const certificatesDB: CertificateRecord[] = [];