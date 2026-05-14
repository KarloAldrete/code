/** Opens files/folders on the host OS. Distinct from `IUrlLauncher` which
 *  is for `http(s)://` URLs in the user's default browser. */
export interface IFileLauncher {
  /** Open the file or directory in its default OS application. Returns the
   *  underlying error string (e.g. file not found, no associated app) or
   *  `null` on success. */
  openPath(path: string): Promise<{ ok: boolean; error: string | null }>;
  /** Reveal the file in the OS file browser (Finder / Explorer). */
  showInFolder(path: string): Promise<void>;
}
