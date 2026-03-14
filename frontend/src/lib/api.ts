import axios from 'axios';


const apiClient = axios.create({
    baseURL: import.meta.env.VITE_BACKEND_URL ?? "",
    headers: {
        'Content-Type': 'application/json'
    }
})

export const getCertificate = async (certificateId: string) => {
    const response = await apiClient.get(`/cert/${certificateId}`)
    return response.data
}

export const generateCertificate = async (data: any) => {
    const response = await apiClient.post('/generate', data)
    return response.data
}