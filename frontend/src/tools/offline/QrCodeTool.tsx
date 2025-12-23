/**
 * ==============================================================================
 * NETKNIFE - QR CODE GENERATOR TOOL
 * ==============================================================================
 * 
 * Generate QR codes for various purposes.
 * 
 * FEATURES:
 * - Plain text/URL encoding
 * - WiFi network configuration
 * - Contact information (vCard)
 * - Email/SMS composition
 * - Customizable size and error correction
 * - Download as PNG
 * ==============================================================================
 */

import { useState, useEffect, useRef } from 'react'
import QRCode from 'qrcode'

type QrType = 'text' | 'url' | 'wifi' | 'email' | 'sms' | 'vcard'
type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H'

interface WifiConfig {
  ssid: string
  password: string
  encryption: 'WPA' | 'WEP' | 'nopass'
  hidden: boolean
}

interface EmailConfig {
  to: string
  subject: string
  body: string
}

interface SmsConfig {
  phone: string
  message: string
}

interface VcardConfig {
  firstName: string
  lastName: string
  phone: string
  email: string
  organization: string
  title: string
}

export default function QrCodeTool() {
  const [qrType, setQrType] = useState<QrType>('text')
  const [textInput, setTextInput] = useState('https://example.com')
  const [size, setSize] = useState(256)
  const [errorCorrection, setErrorCorrection] = useState<ErrorCorrectionLevel>('M')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [error, setError] = useState('')
  
  // WiFi config
  const [wifi, setWifi] = useState<WifiConfig>({
    ssid: '',
    password: '',
    encryption: 'WPA',
    hidden: false,
  })
  
  // Email config
  const [email, setEmail] = useState<EmailConfig>({
    to: '',
    subject: '',
    body: '',
  })
  
  // SMS config
  const [sms, setSms] = useState<SmsConfig>({
    phone: '',
    message: '',
  })
  
  // vCard config
  const [vcard, setVcard] = useState<VcardConfig>({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    organization: '',
    title: '',
  })

  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Generate QR data based on type
  const generateQrData = (): string => {
    switch (qrType) {
      case 'wifi':
        return `WIFI:T:${wifi.encryption};S:${wifi.ssid};P:${wifi.password};H:${wifi.hidden};;`
      
      case 'email':
        const emailParams = new URLSearchParams()
        if (email.subject) emailParams.set('subject', email.subject)
        if (email.body) emailParams.set('body', email.body)
        return `mailto:${email.to}${emailParams.toString() ? '?' + emailParams.toString() : ''}`
      
      case 'sms':
        return `smsto:${sms.phone}:${sms.message}`
      
      case 'vcard':
        return `BEGIN:VCARD
VERSION:3.0
N:${vcard.lastName};${vcard.firstName}
FN:${vcard.firstName} ${vcard.lastName}
ORG:${vcard.organization}
TITLE:${vcard.title}
TEL:${vcard.phone}
EMAIL:${vcard.email}
END:VCARD`
      
      case 'url':
      case 'text':
      default:
        return textInput
    }
  }

  // Generate QR code
  useEffect(() => {
    const data = generateQrData()
    if (!data.trim()) {
      setQrDataUrl('')
      return
    }
    
    QRCode.toDataURL(data, {
      width: size,
      margin: 2,
      errorCorrectionLevel: errorCorrection,
      color: {
        dark: '#ffffff',
        light: '#0d1117',
      },
    })
      .then((dataUrl: string) => {
        setQrDataUrl(dataUrl)
        setError('')
      })
      .catch((err: Error) => {
        setError(err.message)
        setQrDataUrl('')
      })
  }, [qrType, textInput, wifi, email, sms, vcard, size, errorCorrection])

  const downloadQr = () => {
    if (!qrDataUrl) return
    
    const link = document.createElement('a')
    link.download = `qrcode-${qrType}-${Date.now()}.png`
    link.href = qrDataUrl
    link.click()
  }

  const renderInputForm = () => {
    switch (qrType) {
      case 'wifi':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Network Name (SSID)</label>
              <input
                type="text"
                value={wifi.ssid}
                onChange={(e) => setWifi({ ...wifi, ssid: e.target.value })}
                placeholder="MyNetwork"
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Password</label>
              <input
                type="text"
                value={wifi.password}
                onChange={(e) => setWifi({ ...wifi, password: e.target.value })}
                placeholder="••••••••"
                className="input font-mono"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Encryption</label>
              <select
                value={wifi.encryption}
                onChange={(e) => setWifi({ ...wifi, encryption: e.target.value as WifiConfig['encryption'] })}
                className="input"
              >
                <option value="WPA">WPA/WPA2</option>
                <option value="WEP">WEP</option>
                <option value="nopass">None (Open)</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-400">
              <input
                type="checkbox"
                checked={wifi.hidden}
                onChange={(e) => setWifi({ ...wifi, hidden: e.target.checked })}
                className="rounded border-[#30363d] bg-[#21262d]"
              />
              Hidden network
            </label>
          </div>
        )
      
      case 'email':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">To</label>
              <input
                type="email"
                value={email.to}
                onChange={(e) => setEmail({ ...email, to: e.target.value })}
                placeholder="recipient@example.com"
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Subject</label>
              <input
                type="text"
                value={email.subject}
                onChange={(e) => setEmail({ ...email, subject: e.target.value })}
                placeholder="Email subject"
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Body</label>
              <textarea
                value={email.body}
                onChange={(e) => setEmail({ ...email, body: e.target.value })}
                placeholder="Email body..."
                className="input min-h-[100px]"
              />
            </div>
          </div>
        )
      
      case 'sms':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Phone Number</label>
              <input
                type="tel"
                value={sms.phone}
                onChange={(e) => setSms({ ...sms, phone: e.target.value })}
                placeholder="+1234567890"
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Message</label>
              <textarea
                value={sms.message}
                onChange={(e) => setSms({ ...sms, message: e.target.value })}
                placeholder="SMS message..."
                className="input min-h-[100px]"
              />
            </div>
          </div>
        )
      
      case 'vcard':
        return (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm text-gray-400 mb-1">First Name</label>
              <input
                type="text"
                value={vcard.firstName}
                onChange={(e) => setVcard({ ...vcard, firstName: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Last Name</label>
              <input
                type="text"
                value={vcard.lastName}
                onChange={(e) => setVcard({ ...vcard, lastName: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Phone</label>
              <input
                type="tel"
                value={vcard.phone}
                onChange={(e) => setVcard({ ...vcard, phone: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Email</label>
              <input
                type="email"
                value={vcard.email}
                onChange={(e) => setVcard({ ...vcard, email: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Organization</label>
              <input
                type="text"
                value={vcard.organization}
                onChange={(e) => setVcard({ ...vcard, organization: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Title</label>
              <input
                type="text"
                value={vcard.title}
                onChange={(e) => setVcard({ ...vcard, title: e.target.value })}
                className="input"
              />
            </div>
          </div>
        )
      
      case 'url':
      case 'text':
      default:
        return (
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              {qrType === 'url' ? 'URL' : 'Text'}
            </label>
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={qrType === 'url' ? 'https://example.com' : 'Enter any text...'}
              className="input font-mono min-h-[120px]"
            />
          </div>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">QR Code Generator</h1>
        <p className="text-gray-400 mt-1">
          Generate QR codes for URLs, WiFi, contacts, and more
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input */}
        <div className="space-y-4">
          {/* Type Selection */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">QR Code Type</h2>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'text', label: 'Text', icon: '📝' },
                { value: 'url', label: 'URL', icon: '🔗' },
                { value: 'wifi', label: 'WiFi', icon: '📶' },
                { value: 'email', label: 'Email', icon: '✉️' },
                { value: 'sms', label: 'SMS', icon: '💬' },
                { value: 'vcard', label: 'vCard', icon: '👤' },
              ].map(type => (
                <button
                  key={type.value}
                  onClick={() => setQrType(type.value as QrType)}
                  className={`py-2 px-3 rounded text-sm transition-colors ${
                    qrType === type.value
                      ? 'bg-blue-500 text-white'
                      : 'bg-[#21262d] text-gray-400 hover:text-white'
                  }`}
                >
                  <span className="mr-1">{type.icon}</span>
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic Form */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Content</h2>
            {renderInputForm()}
          </div>

          {/* Options */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Options</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Size</label>
                <select
                  value={size}
                  onChange={(e) => setSize(Number(e.target.value))}
                  className="input"
                >
                  <option value={128}>128px (Small)</option>
                  <option value={256}>256px (Medium)</option>
                  <option value={384}>384px (Large)</option>
                  <option value={512}>512px (XL)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Error Correction</label>
                <select
                  value={errorCorrection}
                  onChange={(e) => setErrorCorrection(e.target.value as ErrorCorrectionLevel)}
                  className="input"
                >
                  <option value="L">Low (7%)</option>
                  <option value="M">Medium (15%)</option>
                  <option value="Q">Quartile (25%)</option>
                  <option value="H">High (30%)</option>
                </select>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Higher error correction allows the QR code to work even if partially damaged
            </p>
          </div>
        </div>

        {/* Output */}
        <div className="space-y-4">
          {/* QR Code Preview */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Preview</h2>
              {qrDataUrl && (
                <button
                  onClick={downloadQr}
                  className="btn btn-primary text-sm"
                >
                  Download PNG
                </button>
              )}
            </div>
            
            <div className="flex items-center justify-center bg-[#0d1117] rounded-lg p-8 min-h-[300px]">
              {qrDataUrl ? (
                <img 
                  src={qrDataUrl} 
                  alt="QR Code" 
                  style={{ width: Math.min(size, 300), height: Math.min(size, 300) }}
                  className="pixelated"
                />
              ) : error ? (
                <p className="text-red-400 text-center">{error}</p>
              ) : (
                <p className="text-gray-500 text-center">Enter content to generate QR code</p>
              )}
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Raw Data */}
          {qrDataUrl && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold mb-4">Encoded Data</h3>
              <pre className="p-3 bg-[#161b22] rounded font-mono text-xs text-gray-400 whitespace-pre-wrap break-all">
                {generateQrData()}
              </pre>
            </div>
          )}

          {/* Tips */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-4">Tips</h3>
            <ul className="text-sm text-gray-400 space-y-2">
              <li>• WiFi QR codes work on iOS and Android - just point the camera</li>
              <li>• Higher error correction = more resistant to damage but denser code</li>
              <li>• vCard QR codes add contacts directly to phone</li>
              <li>• Keep content short for easier scanning</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

