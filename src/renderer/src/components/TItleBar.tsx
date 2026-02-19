export default function TitleBar() {
  const buttonStyle: React.CSSProperties & { WebkitAppRegion?: string } = {
    WebkitAppRegion: 'no-drag',
    width: 12,
    height: 12,
    borderRadius: '50%',
    border: 'none',
    marginRight: 8,
    cursor: 'pointer',
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 32,
        padding: '0 12px',
        backgroundColor: '#1e1e1e',
        color: '#fff',
        WebkitAppRegion: 'drag', // make the bar draggable
        justifyContent: 'center', // center title like macOS
        position: 'relative',
      } as React.CSSProperties & { WebkitAppRegion?: string }}
    >
      {/* Control buttons on the left */}
      <div style={{ position: 'absolute', left: 12, display: 'flex', gap: 8 }}>
        <button
          style={{ ...buttonStyle, backgroundColor: '#ff605c' }}
          onClick={() => window.api.close()}
        />
        <button
          style={{ ...buttonStyle, backgroundColor: '#ffbd44' }}
          onClick={() => window.api.minimize()}
        />
        <button
          style={{ ...buttonStyle, backgroundColor: '#00ca56' }}
          onClick={() => window.api.maximize()}
        />
      </div>

      {/* Center title */}
      <div style={{ fontSize: 13, fontWeight: 500, pointerEvents: 'none' }}>
        My Custom Electron App
      </div>
    </div>
  );
}
