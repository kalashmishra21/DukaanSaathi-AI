export default function WorkspacePageLoading() {
  return <div className="workspace-page-loading" role="status" aria-live="polite">
    <span className="workspace-loading-line" />
    <strong>Loading your store view…</strong>
    <p>Your latest records are on their way.</p>
  </div>;
}
