/** OpenStreetMap attribution, required wherever the map is shown. */
export function Attribution() {
  return (
    <a
      className="pointer-events-auto underline underline-offset-2 hover:text-paper"
      href="https://www.openstreetmap.org/copyright"
      target="_blank"
      rel="noreferrer"
    >
      Map data © OpenStreetMap contributors
    </a>
  );
}
