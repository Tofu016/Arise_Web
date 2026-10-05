// Spinner and label for a photo that is slow to arrive.
export default function PhotoLoading() {
  return (
    <div className="photo-loading" role="status">
      <div className="loading-spinner" />
      <span>Loading photo…</span>
    </div>
  );
}
