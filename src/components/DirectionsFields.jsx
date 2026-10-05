// Wraps the From and To fields of the Directions form and draws the route
// graphic in a gutter to their left: a hollow dot centered on From, a broken
// line, and a map pin centered on To. Inline SVG (not <img>) so `currentColor`
// can switch the graphic between white and grey per background. The graphic's
// offsets are computed from the fixed caption and field heights in index.css
// (--dir-label-h, --dir-field-h), so keep those in step with the fields.
export default function DirectionsFields({ children }) {
  return (
    <div className="directions-fields">
      <span className="directions-route-graphic" aria-hidden="true">
        <svg className="directions-route-dot" viewBox="0 0 16 16" width="10" height="10">
          <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
        </svg>
        <span className="directions-route-line" />
        <svg className="directions-route-pin" viewBox="0 0 12.75 18" width="11" height="16">
          <path
            fill="currentColor"
            fillRule="nonzero"
            d="M 6.195312 0.171875 C 2.777344 0.171875 0.00390625 2.945312 0.00390625 6.363281 C 0.00390625 10.164062 3.5 14.785156 5.507812 16.945312 C 5.902344 17.367188 6.496094 17.371094 6.882812 16.945312 C 8.6875 14.96875 12.382812 9.972656 12.382812 6.363281 C 12.382812 2.945312 9.613281 0.171875 6.195312 0.171875 Z M 6.195312 9.382812 C 4.527344 9.382812 3.175781 8.027344 3.175781 6.363281 C 3.175781 4.695312 4.527344 3.34375 6.195312 3.34375 C 7.863281 3.34375 9.214844 4.695312 9.214844 6.363281 C 9.214844 8.027344 7.863281 9.382812 6.195312 9.382812 Z"
          />
        </svg>
      </span>
      {children}
    </div>
  );
}
