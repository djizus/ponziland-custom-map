import styled from 'styled-components';

interface TokenPrice {
  symbol: string;
  address: string;
  ratio: number | null;
}

interface TokenPricesProps {
  prices: TokenPrice[];
}

const PriceContainer = styled.div`
  position: absolute;
  top: 20px;
  left: 20px;
  background: rgba(255, 255, 255, 0.9);
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  max-width: 300px;
`;

const PriceTitle = styled.h3`
  margin: 0 0 10px 0;
  font-size: 16px;
  color: #333;
`;

const PriceList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const PriceItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  color: #666;
  padding: 4px 0;
  border-bottom: 1px solid #eee;

  &:last-child {
    border-bottom: none;
  }
`;

const TokenSymbol = styled.span`
  font-weight: 600;
  min-width: 80px;
`;

const TokenPrice = styled.span`
  font-family: monospace;
`;

const TokenPrices = ({ prices }: TokenPricesProps) => {
  // Sort by symbol, showing tokens with valid ratios first
  const sortedPrices = prices
    .sort((a, b) => {
      // Show tokens with valid ratios first
      if (a.ratio !== null && b.ratio === null) return -1;
      if (a.ratio === null && b.ratio !== null) return 1;
      return a.symbol.localeCompare(b.symbol);
    });

  const formatRatio = (ratio: number | null): string => {
    if (ratio === null || ratio === undefined) {
      return 'N/A';
    }
    if (ratio >= 1) {
      return ratio.toFixed(4);
    }
    // For small numbers, calculate appropriate decimal places
    const decimalPlaces = Math.max(4, -Math.floor(Math.log10(ratio)) + 2);
    return ratio.toFixed(decimalPlaces);
  };

  return (
    <PriceContainer>
      <PriceTitle>Token Prices (in nftSTRK)</PriceTitle>
      <PriceList>
        {sortedPrices.map((price) => (
          <PriceItem key={price.address}>
            <TokenSymbol>{price.symbol}</TokenSymbol>
            <TokenPrice>{formatRatio(price.ratio)}</TokenPrice>
          </PriceItem>
        ))}
      </PriceList>
    </PriceContainer>
  );
};

export default TokenPrices; 