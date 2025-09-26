import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import InventoryCard, { type InventoryEntry } from '../InventoryCard';

describe('InventoryCard', () => {
  it('renders an empty state when there are no items', () => {
    render(<InventoryCard items={[]} />);

    expect(screen.getByText('Backpack')).toBeInTheDocument();
    expect(
      screen.getByText('Your backpack is empty. Collect an item to populate this list instantly.'),
    ).toBeInTheDocument();
  });

  it('renders inventory entries with metadata', () => {
    const items: InventoryEntry[] = [
      {
        id: 'item-1',
        name: 'Atrium Plant',
        description: 'Green plant asset',
        acquiredLabel: '12:45',
        texture: 'plant.png',
      },
    ];

    render(<InventoryCard items={items} />);

    expect(screen.getByText('Atrium Plant')).toBeInTheDocument();
    expect(screen.getByText('12:45')).toBeInTheDocument();
  });
});
