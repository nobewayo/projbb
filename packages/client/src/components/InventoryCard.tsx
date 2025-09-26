export interface InventoryEntry {
  id: string;
  name: string;
  description: string;
  acquiredLabel: string;
  texture: string;
}

interface InventoryCardProps {
  items: InventoryEntry[];
}

const InventoryCard = ({ items }: InventoryCardProps): JSX.Element => (
  <article className="inventory-card">
    <header className="inventory-card__header">
      <h2>Backpack</h2>
      <span className="inventory-card__count">{items.length} items</span>
    </header>
    {items.length === 0 ? (
      <p className="inventory-card__empty">
        Your backpack is empty. Collect an item to populate this list instantly.
      </p>
    ) : (
      <ul className="inventory-card__list">
        {items.map((entry) => (
          <li key={entry.id} className="inventory-card__item" title={entry.description}>
            <span className="inventory-card__avatar" aria-hidden="true">
              <img src={entry.texture} alt="" />
            </span>
            <div className="inventory-card__item-body">
              <span className="inventory-card__item-name">{entry.name}</span>
              <span className="inventory-card__item-meta">{entry.acquiredLabel}</span>
            </div>
          </li>
        ))}
      </ul>
    )}
  </article>
);

export default InventoryCard;
