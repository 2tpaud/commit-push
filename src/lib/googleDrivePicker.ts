/**
 * Google Picker API 연동: Drive에서 파일 선택 후 { name, web_view_link } 반환.
 * - accessToken 없이 호출하면 '구글 드라이브에서 선택' 시점에 Drive 스코프만 요청(Google Identity Services).
 * - NEXT_PUBLIC_GOOGLE_CLIENT_ID 에 웹 클라이언트 ID 설정.
 */

declare global {
  interface Window {
    gapi?: {
      load: (name: string, callback: () => void) => void
    }
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (response: { access_token?: string; error?: string }) => void
          }) => { requestAccessToken: () => void }
        }
      }
      picker?: {
        PickerBuilder: new () => {
          setOAuthToken(token: string): unknown
          addView(view: unknown): unknown
          setCallback(callback: (data: GooglePickerResponse) => void): unknown
          setAppId(appId: string): unknown
          build(): { setVisible: (visible: boolean) => void }
        }
        ViewId: { DOCS: unknown }
        DocsView: new (viewId: unknown) => {
          setIncludeFolders: (included: boolean) => unknown
          setParent: (parentId: string) => unknown
        }
      }
    }
  }
}

export interface PickedDriveFile {
  name: string
  web_view_link: string
}

interface GooglePickerDoc {
  id?: string
  name?: string
  url?: string
  parentId?: string
}

interface GooglePickerResponse {
  action?: string
  docs?: GooglePickerDoc[]
}

const SCRIPT_URL = 'https://apis.google.com/js/api.js'
const GSI_SCRIPT_URL = 'https://accounts.google.com/gsi/client'
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
/** 우리 쪽 Drive 다이얼로그에서 목록 조회용. drive.file은 앱이 연 파일만 보여서 목록이 비어 있음. */
const DRIVE_READONLY_SCOPE = 'https://www.googleapis.com/auth/drive.readonly'
/** Drive 토큰 캐시 (동의는 한 번만, 같은 탭에서 재사용). 만료 5분 전이면 재요청 */
const TOKEN_CACHE_MS = (60 - 5) * 60 * 1000

/** 피커 마지막 폴더 ID (재오픈 시 해당 경로에서 열기). 로그인 시에만 초기화. */
const DRIVE_PICKER_LAST_FOLDER_KEY = 'drivePickerLastFolderId'

export function getDrivePickerLastFolderId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const v = localStorage.getItem(DRIVE_PICKER_LAST_FOLDER_KEY)
    return v && v.trim() ? v.trim() : null
  } catch {
    return null
  }
}

export function setDrivePickerLastFolderId(id: string | null): void {
  if (typeof window === 'undefined') return
  try {
    if (id) localStorage.setItem(DRIVE_PICKER_LAST_FOLDER_KEY, id)
    else localStorage.removeItem(DRIVE_PICKER_LAST_FOLDER_KEY)
  } catch {
    /* ignore */
  }
}

/** 로그인 시 호출하여 다음 피커 오픈 시 루트에서 열리게 함 */
export function clearDrivePickerLastFolderOnLogin(): void {
  setDrivePickerLastFolderId(null)
}

let cachedDriveToken: string | null = null
let cachedDriveTokenExpiresAt = 0

function loadScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('window undefined'))
  const existing = document.querySelector(`script[src="${SCRIPT_URL}"]`)
  if (existing) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google API script'))
    document.head.appendChild(script)
  })
}

function loadGSIScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('window undefined'))
  const existing = document.querySelector(`script[src="${GSI_SCRIPT_URL}"]`)
  if (existing) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GSI_SCRIPT_URL
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'))
    document.head.appendChild(script)
  })
}

function requestDriveAccessToken(clientId: string, scope: string = DRIVE_SCOPE): Promise<string> {
  return new Promise((resolve, reject) => {
    const google = window.google
    if (!google?.accounts?.oauth2?.initTokenClient) {
      reject(new Error('Google Identity Services를 불러오지 못했습니다.'))
      return
    }
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope,
      callback: (response: { access_token?: string; error?: string }) => {
        if (response.access_token) resolve(response.access_token)
        else reject(new Error(response.error || 'Drive 접근 권한이 필요합니다.'))
      },
    })
    client.requestAccessToken()
  })
}

/** Drive API 호출용 액세스 토큰 (캐시 사용). 우리 쪽 다이얼로그에서 파일 목록 조회할 때 사용. drive.readonly로 목록/메타 조회 가능. */
export async function getDriveAccessToken(): Promise<string> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  if (!clientId?.trim()) throw new Error('NEXT_PUBLIC_GOOGLE_CLIENT_ID를 설정해 주세요.')
  const now = Date.now()
  if (cachedDriveToken && cachedDriveTokenExpiresAt > now) return cachedDriveToken
  await loadGSIScript()
  const token = await requestDriveAccessToken(clientId, DRIVE_READONLY_SCOPE)
  cachedDriveToken = token
  cachedDriveTokenExpiresAt = now + TOKEN_CACHE_MS
  return token
}

function loadPicker(): Promise<void> {
  const gapi = window.gapi
  if (!gapi) return Promise.reject(new Error('gapi not loaded'))
  return new Promise((resolve) => {
    gapi.load('picker', () => resolve())
  })
}

/**
 * Google Picker를 띄우고, 사용자가 선택한 Drive 파일 목록을 onPick으로 전달.
 * @param accessToken - 없으면 '구글 드라이브에서 선택' 클릭 시점에 Drive 스코프만 요청(GIS). 있으면 그대로 사용.
 * @param onPick - (선택된 파일 목록, 선택된 파일들의 부모 폴더 ID) → 다음 열 때 startFolderId로 쓰면 해당 경로에서 열림
 * @param onError - 스크립트/토큰 오류 시 호출
 * @param startFolderId - (선택) Picker를 열 때 이 폴더를 최초 표시. 없으면 루트.
 * @param onDismiss - Picker가 닫힐 때(선택/취소 모두) 호출. 상위 다이얼로그가 바깥 클릭으로 닫히지 않게 할 때 사용.
 */
export async function openGoogleDrivePicker(
  accessToken: string | undefined,
  onPick: (files: PickedDriveFile[], parentFolderId?: string) => void,
  onError: (message: string) => void,
  startFolderId?: string,
  onDismiss?: () => void
): Promise<void> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  if (!clientId?.trim()) {
    onError('Google Drive 연동을 위해 NEXT_PUBLIC_GOOGLE_CLIENT_ID를 설정해 주세요.')
    return
  }

  let token = accessToken?.trim()
  if (!token) {
    const now = Date.now()
    if (cachedDriveToken && cachedDriveTokenExpiresAt > now) {
      token = cachedDriveToken
    } else {
      try {
        await loadGSIScript()
        token = await requestDriveAccessToken(clientId)
        cachedDriveToken = token
        cachedDriveTokenExpiresAt = now + TOKEN_CACHE_MS
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Drive 접근 권한을 허용해 주세요.')
        return
      }
    }
  }

  try {
    await loadScript()
  } catch {
    onError('Google API 스크립트를 불러오지 못했습니다.')
    return
  }

  const gapi = window.gapi
  const google = window.google
  if (!gapi || !google?.picker) {
    await loadPicker()
  }

  const picker = window.google?.picker
  if (!picker) {
    onError('Google Picker를 사용할 수 없습니다.')
    return
  }
  if (!token) {
    onError('Drive 접근 권한을 허용해 주세요.')
    return
  }

  const docsView = new picker.DocsView(picker.ViewId.DOCS)
  docsView.setIncludeFolders(true)
  docsView.setParent(startFolderId?.trim() || 'root')

  const builder = new picker.PickerBuilder() as {
    setOAuthToken(t: string): typeof builder
    addView(v: unknown): typeof builder
    setCallback(cb: (data: GooglePickerResponse) => void): typeof builder
    setAppId(id: string): typeof builder
    build(): { setVisible(visible: boolean): void }
  }
  builder
    .setOAuthToken(token)
    .addView(docsView)
    .setCallback((data: GooglePickerResponse) => {
      if (data.action === 'picked' && data.docs?.length) {
        const files: PickedDriveFile[] = data.docs.map((doc) => {
          const id = doc.id ?? ''
          const name = (doc.name ?? '').trim() || '첨부파일'
          const webViewLink =
            doc.url?.trim() || `https://drive.google.com/file/d/${id}/view`
          return { name, web_view_link: webViewLink }
        })
        const parentFolderId = data.docs[0]?.parentId?.trim() || undefined
        onPick(files, parentFolderId)
      }
      onDismiss?.()
    })

  // Picker API: setAppId는 Google Cloud 프로젝트 번호(선택). 없어도 Picker는 동작할 수 있음.
  const appId = process.env.NEXT_PUBLIC_GOOGLE_APP_ID?.trim()
  if (appId) builder.setAppId(appId)

  builder.build().setVisible(true)

  // Picker가 모달 뒤에 가려지지 않도록 z-index 상승 (Google이 body에 붙이는 요소/iframe 대상)
  const raisePickerZIndex = () => {
    try {
      document.querySelectorAll('.picker-dialog, .picker-dialog-bg, [class*="picker"]').forEach((el) => {
        const html = el as HTMLElement
        if (html.style) html.style.zIndex = '999999'
      })
      document.querySelectorAll('body > iframe').forEach((el) => {
        const iframe = el as HTMLIFrameElement
        if (iframe.src?.includes('google') || iframe.src?.includes('drive')) {
          iframe.style.zIndex = '999999'
        }
      })
    } catch (_) { /* ignore */ }
  }
  setTimeout(raisePickerZIndex, 150)
  setTimeout(raisePickerZIndex, 600)
}
