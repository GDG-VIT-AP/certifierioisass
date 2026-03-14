import { useParams } from 'react-router-dom'

export default function ViewCertificatePage() {
  const { certificateId } = useParams()

  return (
  <div>Certificate ID: {certificateId}</div>
  );
}