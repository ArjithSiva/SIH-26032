const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
];

export default function PhoneKeypad({ onPress, disabled }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {KEYS.flat().map((key) => (
        <button
          key={key}
          type="button"
          disabled={disabled}
          onClick={() => onPress(key)}
          className="aspect-square rounded-full border border-border bg-white text-h3 text-ink hover:bg-primary-light hover:border-primary disabled:opacity-40 disabled:hover:bg-white"
        >
          {key}
        </button>
      ))}
    </div>
  );
}
