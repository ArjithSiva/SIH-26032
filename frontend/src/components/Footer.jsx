// Content here is placeholder text in the shape GIGW expects (content
// ownership, last-updated date, contact point, accessibility statement) -
// replace with the real department name/contact/URL before any live
// deployment. Marked data-voiceover-skip so the read-aloud button doesn't
// repeat this on every page.
export default function Footer() {
  return (
    <footer data-voiceover-skip className="mt-16 border-t border-border bg-surface">
      <div className="mx-auto max-w-5xl px-5 py-8 text-small text-muted">
        <div className="grid gap-6 sm:grid-cols-3">
          <div>
            <p className="text-p2-medium text-ink">Kalanjiyam</p>
            <p className="mt-1">Smart Procurement Queue Management System</p>
            <p>Department of Civil Supplies, Government of Tamil Nadu (prototype)</p>
          </div>
          <div>
            <p className="text-p2-medium text-ink">Contact</p>
            <p className="mt-1">Toll-free helpline: 1800-XXX-XXXX</p>
            <p>Email: support@example.gov.in</p>
          </div>
          <div>
            <p className="text-p2-medium text-ink">Policies</p>
            <p className="mt-1">Content owned and maintained by the Department of Civil Supplies</p>
            <p>Last updated: {new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>
        <p className="mt-6 border-t border-border pt-4">
          This site follows the Guidelines for Indian Government Websites (GIGW) for accessibility and content
          standards. If any page is difficult to use with a screen reader or keyboard alone, please contact the
          helpline above.
        </p>
      </div>
    </footer>
  );
}
