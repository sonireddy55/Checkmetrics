// Fingerprint for abuse prevention
import FingerprintJS from '@fingerprintjs/fingerprintjs'

let cachedFingerprint: string | null = null

export async function getDeviceFingerprint(): Promise<string> {
  if (cachedFingerprint) return cachedFingerprint
  
  try {
    const fp = await FingerprintJS.load()
    const result = await fp.get()
    cachedFingerprint = result.visitorId
    return cachedFingerprint
  } catch (error) {
    // Fallback to random ID stored in chrome.storage
    const stored = await chrome.storage.local.get(['device_id'])
    if (stored.device_id) return stored.device_id
    
    const newId = crypto.randomUUID()
    await chrome.storage.local.set({ device_id: newId })
    return newId
  }
}
