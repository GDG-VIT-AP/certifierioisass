import './App.css'
import { BrowserRouter } from 'react-router-dom'
import { Routes, Route } from 'react-router-dom'
import ViewCertificatePage from './pages/ViewCertificate'
import GenerateCertificatePage from './pages/GenerateCertificate'

function App() {

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/cert/:certificateId" element={<ViewCertificatePage />} />
        <Route path='/generate' element={<GenerateCertificatePage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
