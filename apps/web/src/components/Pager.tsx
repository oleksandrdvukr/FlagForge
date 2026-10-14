interface PagerProps {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}

export function Pager({ page, pageSize, total, onPage }: PagerProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages === 1) return null;
  return (
    <nav className="pager" aria-label="Pagination">
      <button
        type="button"
        className="btn btn-small"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        Previous
      </button>
      <span className="pager-status">
        Page {page} of {pages}
      </span>
      <button
        type="button"
        className="btn btn-small"
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
      >
        Next
      </button>
    </nav>
  );
}
