// Placeholders shown while data loads. Each one has the outline of what will replace it,
// so the page doesn't jump when the content arrives. Screen readers get the label instead.

function Busy({ label, className, children }) {
  return (
    <div role="status" aria-busy="true" className={className ? `loading ${className}` : 'loading'}>
      <span className="visually-hidden">{label}</span>
      {children}
    </div>
  );
}

const Bar = ({ w = '100%', h, className }) => <span aria-hidden="true" className={className ? `skeleton ${className}` : 'skeleton'} style={{ width: w, height: h }} />;

/** A paragraph: full lines, with a shorter last one. */
export function SkeletonLines({ count = 3, last = '60%', className }) {
  return (
    <span aria-hidden="true" className={className ? `skeleton-lines ${className}` : 'skeleton-lines'}>
      {Array.from({ length: count }, (_, i) => <Bar key={i} w={i === count - 1 ? last : '100%'} />)}
    </span>
  );
}

/** "In plain words": a summary and a grid of notes. */
export function ReadingSkeleton({ label }) {
  return (
    <Busy label={label}>
      <SkeletonLines count={4} className="large" last="45%" />
      <div className="areas">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton-card">
            <Bar w="40%" className="heading" />
            <SkeletonLines count={3} last="70%" />
          </div>
        ))}
      </div>
    </Busy>
  );
}

/** A whole chart page: name, reading, then the kundli. */
export function ChartPageSkeleton({ label }) {
  return (
    <Busy label={label}>
      <Bar w="16rem" className="title" />
      <Bar w="12rem" className="heading" />
      <div className="plain"><Bar w="10rem" className="subtitle" /></div>
      <SkeletonLines count={4} className="large" last="45%" />
      <div className="chart-grid">
        <Bar className="square" />
        <div><SkeletonLines count={5} last="35%" /></div>
      </div>
    </Busy>
  );
}

/** The personal day: reading on the left, the day's facts on the right. */
export function DaySkeleton({ label }) {
  return (
    <Busy label={label} className="day">
      <div>
        <Bar w="7rem" className="chip" />
        <Bar w="80%" className="title tall" />
        <SkeletonLines count={5} className="large" last="55%" />
      </div>
      <div className="day-why">
        <Bar w="60%" className="heading" />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton-row"><Bar w="35%" className="small" /><Bar w={`${85 - i * 9}%`} /></div>
        ))}
      </div>
    </Busy>
  );
}

/** A list of saved people. */
export function ListSkeleton({ label, rows = 3 }) {
  return (
    <Busy label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton-item">
          <div><Bar w="11rem" className="subtitle" /><Bar w="18rem" className="small" /></div>
          <Bar w="7.5rem" className="button-shape" />
        </div>
      ))}
    </Busy>
  );
}

/** A conversation being fetched. */
export function ThreadSkeleton({ label }) {
  return (
    <Busy label={label} className="thread">
      <Bar w="45%" className="bubble q" />
      <Bar w="80%" className="bubble a" />
    </Busy>
  );
}

/** One horoscope reading. */
export function ReadingCardSkeleton({ label }) {
  return (
    <Busy label={label} className="reading">
      <Bar w="7rem" className="chip" />
      <Bar w="55%" className="subtitle" />
      <SkeletonLines count={4} className="large" last="50%" />
    </Busy>
  );
}
