
// Fenêtre d'un lieu de la ville (atelier, coffre, marché...). Le contenu vient de `renderBuilding`.
export default function BuildingModal({ building, onClose, renderBuilding }) {
  if (!building) return null;
  return (
    <div className="mp-modal" onClick={onClose}>
      <div className="mp-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="mp-modal-head">
          <span>{building.name}</span>
          <button className="cb-btn small" onClick={onClose}>Fermer ✕</button>
        </div>
        <div className="mp-modal-body">
          {renderBuilding ? renderBuilding(building.kind, building) : null}
        </div>
      </div>
    </div>
  );
}
