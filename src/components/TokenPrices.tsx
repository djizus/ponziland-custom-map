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
  // Filter out tokens without ratios and sort by symbol
  const validPrices = prices
    .filter(price => price.ratio !== null)
    .sort((a, b) => a.symbol.localeCompare(b.symbol));

  return (
    <PriceContainer>
      <PriceTitle>Token Prices (in eSTRK)</PriceTitle>
      <PriceList>
        {validPrices.map((price) => (
          <PriceItem key={price.address}>
            <TokenSymbol>{price.symbol}</TokenSymbol>
            <TokenPrice>{price.ratio ? price.ratio.toFixed(4) : 'N/A'}</TokenPrice>
          </PriceItem>
        ))}
      </PriceList>
    </PriceContainer>
  );
};

export default TokenPrices; 