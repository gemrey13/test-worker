import { JSX } from 'react'

export default function App(): JSX.Element {
  return (
    <div style={{ padding: 20 }}>
      <h1>Electron Vite Node Worker</h1>

      <Test />
    </div>
  )
}

function Test() {
  const handleImport = async () => {
    const result = await window.api.startImport()
    console.log(result)
    alert(`Imported ${result.totalInserted} records`)
  }

  const handleImportGrab = async () => {
    const result = await window.api.startImportGrab()
    console.log(result)
    alert(`Imported ${result.totalInserted} records`)
  }

  return (
    <div style={{ padding: 20 }}>
      <div>
        <h1>POS Importer</h1>
        <button onClick={handleImport}>Start Import</button>
      </div>

      <div>
        <h1>GRAB Importer</h1>
        <button onClick={handleImportGrab}>Start Import GRAB</button>
      </div>
    </div>
  )
}
