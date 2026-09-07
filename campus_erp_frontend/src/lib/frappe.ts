/**
 * Thin client over the Frappe REST/RPC API.
 *
 * Three concerns, per the migration blueprint's Frontend Architecture (§5.4):
 *  1. CRUD against `/api/resource/<DocType>` for Master/Detail screens.
 *  2. Whitelisted RPC against `/api/method/campus_erp.api.<module>.<fn>` for
 *     every business rule (enrollment, assessment, GL posting, payroll, fines) —
 *     the frontend never re-implements these, it only calls them.
 *  3. (Phase 2+) Realtime via Frappe's socketio channel.
 *
 * In development, Next.js proxies /api/* to the bench (see next.config.ts) so
 * the Frappe session cookie stays same-origin.
 */
import axios, { type AxiosInstance } from "axios"

const frappeClient: AxiosInstance = axios.create({
  baseURL: "/",
  withCredentials: true,
  headers: {
    "X-Frappe-CSRF-Token": "",
  },
})

// Frappe issues a CSRF token on the logged-in session (frappe.csrf_token via
// boot info). Once the auth provider fetches boot info, it calls this to make
// every subsequent write request valid.
//
// This must mutate the same top-level `headers` bucket that axios.create()
// was given below, not `.defaults.headers.common`: axios merges a plain
// custom header key placed directly under `defaults.headers` (as opposed to
// under `.common`/`.get`/`.post`/etc.) with priority over `.common`, so a
// `.common` write here was silently overridden by the "" set at creation
// time on every single request — every write request went out with an
// empty CSRF token regardless of a real one being fetched, which is what
// made every save/submit fail with a CSRF error.
export function setCSRFToken(token: string | undefined) {
  if (token) {
    frappeClient.defaults.headers["X-Frappe-CSRF-Token"] = token
  }
}

export function clearCSRFToken() {
  frappeClient.defaults.headers["X-Frappe-CSRF-Token"] = ""
}

/**
 * Frappe surfaces thrown business-rule errors (frappe.throw) as a 417/403/500
 * response carrying `_server_messages` (a JSON-encoded array of JSON-encoded
 * {message,...} objects) rather than a flat `message` string — this unwraps
 * that so callers can show the real reason instead of "Request failed with
 * status code 417".
 */
/**
 * frappe.throw messages are HTML (they often link to the conflicting doc,
 * e.g. `Cannot delete because Student <a href="...">EDU-STU-...</a> is
 * linked with ...`) — meant for the Desk UI, which renders it as markup.
 * Toasts here render it as plain text, so left alone the tags show up
 * literally. Strip them down to their link text instead.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<a\b[^>]*>(.*?)<\/a>/gi, "$1")
    .replace(/<[^>]*>/g, "")
    .trim()
}

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string; exception?: string; _server_messages?: string }
      | undefined
    if (data?._server_messages) {
      try {
        const messages = JSON.parse(data._server_messages) as string[]
        if (messages[0]) {
          const parsed = JSON.parse(messages[0]) as { message?: string }
          if (parsed.message) return stripHtml(parsed.message)
        }
      } catch {
        // fall through to the other fields
      }
    }
    if (data?.exception) return stripHtml(data.exception.replace(/^[\w.]+:\s*/, ""))
    if (data?.message) return stripHtml(data.message)
  }
  return "Something went wrong"
}

export interface FrappeListParams {
  fields?: string[]
  filters?: Array<[string, string, unknown]> | Record<string, unknown>
  /**
   * OR'd together, as opposed to `filters` (AND'd) — e.g. matching a search
   * box's text against either of two different fields. Forwarded verbatim
   * to `frappe.client.get_list`'s own `or_filters` kwarg (the REST resource
   * endpoint passes every query param straight through to it).
   */
  or_filters?: Array<[string, string, unknown]>
  order_by?: string
  limit_start?: number
  limit_page_length?: number
}

export const frappe = {
  /** GET /api/resource/<doctype> — list view for Master/Detail screens. */
  async list<T = Record<string, unknown>>(
    doctype: string,
    params: FrappeListParams = {}
  ): Promise<T[]> {
    const { data } = await frappeClient.get(
      `/api/resource/${encodeURIComponent(doctype)}`,
      {
        params: {
          fields: JSON.stringify(params.fields ?? ["name"]),
          filters: params.filters ? JSON.stringify(params.filters) : undefined,
          or_filters: params.or_filters ? JSON.stringify(params.or_filters) : undefined,
          order_by: params.order_by,
          limit_start: params.limit_start,
          limit_page_length: params.limit_page_length ?? 20,
        },
      }
    )
    return data.data as T[]
  },

  /** GET /api/resource/<doctype>/<name> — single document for detail panels. */
  async getDoc<T = Record<string, unknown>>(
    doctype: string,
    name: string
  ): Promise<T> {
    const { data } = await frappeClient.get(
      `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`
    )
    return data.data as T
  },

  /** POST /api/resource/<doctype> — create. */
  async createDoc<T = Record<string, unknown>>(
    doctype: string,
    values: Record<string, unknown>
  ): Promise<T> {
    const { data } = await frappeClient.post(
      `/api/resource/${encodeURIComponent(doctype)}`,
      values
    )
    return data.data as T
  },

  /** PUT /api/resource/<doctype>/<name> — update. */
  async updateDoc<T = Record<string, unknown>>(
    doctype: string,
    name: string,
    values: Record<string, unknown>
  ): Promise<T> {
    const { data } = await frappeClient.put(
      `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`,
      values
    )
    return data.data as T
  },

  /** DELETE /api/resource/<doctype>/<name>. */
  async deleteDoc(doctype: string, name: string): Promise<void> {
    await frappeClient.delete(
      `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`
    )
  },

  /** POST /api/method/upload_file — multipart file upload, returns the stored file's URL for use in an Attach/Attach Image field. */
  async uploadFile(
    file: File,
    opts: { isPrivate?: boolean } = {}
  ): Promise<{ file_url: string; name: string }> {
    const form = new FormData()
    form.append("file", file)
    form.append("is_private", opts.isPrivate ? "1" : "0")
    const { data } = await frappeClient.post("/api/method/upload_file", form)
    return data.message as { file_url: string; name: string }
  },

  /**
   * Whitelisted RPC — every business rule identified in the blueprint's
   * Backend Architecture (§4.3) lives behind campus_erp.api.<module>.<fn>,
   * never re-implemented client-side.
   */
  async call<T = unknown>(
    method: string,
    args: Record<string, unknown> = {}
  ): Promise<T> {
    const { data } = await frappeClient.post(`/api/method/${method}`, args)
    return data.message as T
  },

  /**
   * Whitelisted RPC via GET rather than POST. Frappe only enforces the CSRF
   * check on POST/PUT/DELETE/PATCH (frappe/auth.py's UNSAFE_HTTP_METHODS) —
   * GET is unconditionally exempt, session state notwithstanding. Reserved
   * for genuinely read-only calls that must succeed before this client has
   * any CSRF token to send (chiefly me() — see its own comment below); do
   * not use this for anything that writes.
   */
  async callGet<T = unknown>(
    method: string,
    args: Record<string, unknown> = {}
  ): Promise<T> {
    const { data } = await frappeClient.get(`/api/method/${method}`, { params: args })
    return data.message as T
  },

  /**
   * frappe.model.workflow.get_transitions — the valid next actions for the
   * current user on this doc, given their roles and its current workflow
   * state. Empty array if none apply right now.
   */
  async getWorkflowTransitions(
    doctype: string,
    name: string
  ): Promise<Array<{ action: string; next_state: string }>> {
    return frappe.call<Array<{ action: string; next_state: string }>>(
      "frappe.model.workflow.get_transitions",
      { doc: JSON.stringify({ doctype, name }) }
    )
  },

  /**
   * frappe.model.workflow.apply_workflow — executes one named transition
   * (an `action` from getWorkflowTransitions), updating the workflow state
   * field and, only if the target state's docstatus differs from the
   * current one, submitting or cancelling the document as a side effect.
   */
  async applyWorkflowAction(
    doctype: string,
    name: string,
    action: string
  ): Promise<Record<string, unknown>> {
    return frappe.call<Record<string, unknown>>("frappe.model.workflow.apply_workflow", {
      doc: JSON.stringify({ doctype, name }),
      action,
    })
  },

  async login(usr: string, pwd: string) {
    const { data } = await frappeClient.post("/api/method/login", { usr, pwd })
    return data
  },

  async logout() {
    try {
      const session = await frappe.callGet<{ csrf_token: string }>(
        "campus_erp.api.auth.me"
      )
      setCSRFToken(session.csrf_token)
      await frappeClient.post("/api/method/logout")
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 400) {
        throw error
      }
    } finally {
      clearCSRFToken()
    }
  },

  /**
   * campus_erp.api.auth.me() — roles + visible module list for the sidebar.
   * Called via callGet (GET), not call (POST): this is the very first
   * request made on every page load, before this client holds any CSRF
   * token — a POST here would only succeed on a session's first-ever call
   * (when the server has no csrf_token recorded yet to check against) and
   * fail with CSRFTokenError on every refresh after that, since the server
   * generates and remembers a token the first time regardless, while this
   * client's in-memory token is wiped by the reload. That 400 was getting
   * swallowed by AuthProvider's catch block and read as "not logged in,"
   * which is what actually caused the redirect-to-login-on-refresh bug.
   */
  async me() {
    return frappe.callGet<{
      user: string
      full_name: string
      roles: string[]
      modules: string[]
      csrf_token: string
    }>("campus_erp.api.auth.me")
  },
}

export default frappeClient
