import * as React from 'react';
import { Component } from 'react';
import styled from 'styled-components';
import { BigNumber } from 'bignumber.js';
import { ZeroEx, SignedOrder, Token } from '0x.js';
import { RBTree } from 'bintrees';
import { NavLink } from 'react-router-dom';
import { TradeTable } from '../components/TradeTable';
import { ZeroExFeed, OrderbookSnapshot } from '../components/ZeroExFeed';
import {
  LeftNavContainer,
  LeftNavHeader,
  LeftNavHeaderLogo,
  LeftNavHeaderTitle,
  LeftNavSectionContainer,
  LeftNavSectionTitle,
  LeftNavListItem,
} from '../components/NavPanel';
import {
  SidePanel,
  SidePanelContent,
  SidePanelHeader,
  SidePanelListItem,
} from '../components/RecentFillsPanel';
import sizing from '../util/sizing';
import colors from '../util/colors';
import { FullTokenPairData } from '../types';
const logo = require('../assets/icons/conduit-white.svg');

const AppContent = styled.div`
  display: flex;
  flex: 1;
  height: 100%;
`;

const OrderbookHeader = styled.div`
  height: 4rem;
  padding-left: 4rem;
  background: #ffffff;
  display: flex;
  align-items: center;
  @media (max-width: ${sizing.mediumMediaQuery}) {
    padding-left: 2rem;
  }
`;

const OrderbookHeaderTitle = styled.h1`
  font-size: 1.5rem;
  font-weight: 700;
  color: #33354a;
  letter-spacing: 0;
`;

const OrderbookContent = styled.div`
  display: flex;
  flex: 1;
`;

const ContentPanel = styled.section`
  display: flex;
  flex: 1;
  flex-basis: 40rem;
  flex-direction: column;
  padding: 0 4rem;
  background-image: linear-gradient(-180deg, #f7f7f8 0%, #ffffff 100%);
  @media (max-width: ${sizing.mediumMediaQuery}) {
    padding: 0 2rem;
  }
`;

const MarketSummary = styled.h1`
  display: flex;
  flex-direction: row;
  flex: 1;
  flex-shrink: 0;
  flex-basis: 6rem;
  height: 6rem;
  max-height: 6rem;
  align-items: center;
  padding-top: 0;
  font-size: 2rem;
  font-weight: 300;
  letter-spacing: 0.5px;
  color: ${colors.darkBlue};
`;

const BidsAndAsksTablesContainer = styled.div`
  display: flex;
  flex-direction: row;
  flex: 1;
  @media (max-width: ${sizing.mediumMediaQuery}) {
    flex-direction: column;
  }
`;

const AskTableContainer = styled.div`
  position: relative;
  display: flex;
  max-height: 480px;
  flex: 1;
  margin-bottom: 2rem;
  box-shadow: 0 2px 4px 0 rgba(36, 48, 86, 0.2);
  @media (min-width: ${sizing.mediumMediaQuery}) {
    margin-right: ${sizing.spacingMedium};
  }
`;

const BidTableContainer = styled.div`
  position: relative;
  display: flex;
  max-height: 480px;
  flex: 1;
  margin-bottom: 2rem;
  box-shadow: 0 2px 4px 0 rgba(36, 48, 86, 0.2);
`;

const OrderbookContainer = styled.div`
  display: flex;
  height: 100%;
  flex: 1;
  flex-direction: column;
`;

export interface OrderbookProps {
  wsEndpoint: string;
  selectedBaseToken: Token;
  selectedQuoteToken: Token;
  availableTokenPairs: Array<FullTokenPairData>;
}

export interface OrderbookState {
  loading: boolean;
  bids: RBTree<SignedOrder>;
  asks: RBTree<SignedOrder>;
  orderDetailsMap: WeakMap<SignedOrder, OrderDetails>;
  recentFills: Array<any>;
}

export interface OrderDetails {
  price: BigNumber;
}

class TokenPairOrderbook extends Component<OrderbookProps, OrderbookState> {
  feed: ZeroExFeed | null;
  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      bids: new RBTree<SignedOrder>(this.sortOrdersAsc),
      asks: new RBTree<SignedOrder>(this.sortOrdersDesc),
      orderDetailsMap: new WeakMap<SignedOrder, OrderDetails>(),
      recentFills: [],
    };
  }

  componentDidMount() {
    this.feed &&
      this.feed.subscribeToOrderbook(
        this.props.selectedBaseToken.address,
        this.props.selectedQuoteToken.address
      );
  }

  componentWillReceiveProps(nextProps: OrderbookProps) {
    if (
      nextProps.selectedBaseToken.address !== this.props.selectedBaseToken.address ||
      nextProps.selectedQuoteToken.address !== this.props.selectedQuoteToken.address
    ) {
      console.log('new pair to look at, resetting state');
      this.setState({
        bids: new RBTree<SignedOrder>(this.sortOrdersAsc),
        asks: new RBTree<SignedOrder>(this.sortOrdersDesc),
        orderDetailsMap: new WeakMap<SignedOrder, OrderDetails>(),
        recentFills: [],
        loading: true,
      });
      this.feed &&
        this.feed.subscribeToOrderbook(
          nextProps.selectedBaseToken.address,
          nextProps.selectedQuoteToken.address
        );
    }
  }

  handleSocketMessage = (_: MessageEvent) => {};

  handleOrderbookUpdate(orderbookUpdate) {
    console.log(orderbookUpdate);
  }

  handleOrderbookFill(fill) {
    console.log(fill);
  }

  handleOrderbookSnapshot = (snapshot: OrderbookSnapshot) => {
    const { bids, asks } = snapshot;
    // const { baseToken, quoteToken } = this.props;
    bids.forEach(this.addBidToOrderbook);
    asks.forEach(this.addAskToOrderbook);
    if (this.state.loading) {
      this.setState({ loading: false });
    }
  };

  private addAskToOrderbook = (ask: SignedOrder) => {
    const { selectedBaseToken, selectedQuoteToken } = this.props;
    const orderDetail = this.computeOrderDetails(
      ask,
      selectedBaseToken.address,
      selectedQuoteToken.address
    );
    this.addOrderDetails(ask, orderDetail);
    this.addAsk(ask);
  };

  private addBidToOrderbook = (bid: SignedOrder) => {
    const { selectedBaseToken, selectedQuoteToken } = this.props;
    const orderDetail = this.computeOrderDetails(
      bid,
      selectedBaseToken.address,
      selectedQuoteToken.address
    );
    this.addOrderDetails(bid, orderDetail);
    this.addBid(bid);
  };

  private addOrderDetails(signedOrder: SignedOrder, orderDetails: OrderDetails) {
    this.setState((prevState: OrderbookState) => {
      const { orderDetailsMap } = prevState;
      orderDetailsMap.set(signedOrder, orderDetails);
      return { orderDetailsMap };
    });
  }

  private addAsk(ask: SignedOrder) {
    this.setState((prevState: OrderbookState) => {
      const { asks } = prevState;
      asks.insert(ask);
      return { asks };
    });
  }

  private addBid(bid: SignedOrder) {
    this.setState((prevState: OrderbookState) => {
      const { bids } = prevState;
      bids.insert(bid);
      return { bids };
    });
  }

  private getPriceForSignedOrder = signedOrder => {
    let data = this.state.orderDetailsMap.get(signedOrder);
    if (!data) {
      const orderDetail = this.computeOrderDetails(
        signedOrder,
        this.props.selectedBaseToken.address,
        this.props.selectedQuoteToken.address
      );
      this.addOrderDetails(signedOrder, orderDetail);
      data = orderDetail;
    }
    return data.price;
  };

  private computeOrderDetails(
    order: SignedOrder,
    baseTokenAddress: string,
    quoteTokenAddress: string
  ) {
    const makerToken =
      this.props.selectedBaseToken.address === order.makerTokenAddress
        ? this.props.selectedBaseToken
        : this.props.selectedQuoteToken;

    const takerToken =
      this.props.selectedBaseToken.address === order.takerTokenAddress
        ? this.props.selectedBaseToken
        : this.props.selectedQuoteToken;

    const makerUnitAmount = ZeroEx.toUnitAmount(
      new BigNumber(order.makerTokenAmount),
      makerToken.decimals
    );
    const takerUnitAmount = ZeroEx.toUnitAmount(
      new BigNumber(order.takerTokenAmount),
      takerToken.decimals
    );

    // is it a bid (buy) or ask (sell)
    const isBid = baseTokenAddress === makerToken.address;
    const baseUnitAmount = isBid ? makerUnitAmount : takerUnitAmount;
    const quoteUnitAmount = isBid ? takerUnitAmount : makerUnitAmount;
    const price: BigNumber = quoteUnitAmount.div(baseUnitAmount);
    return {
      price,
      baseUnitAmount,
      quoteUnitAmount,
    };
  }

  // b - a
  private sortOrdersAsc = (a: SignedOrder, b: SignedOrder) => {
    if (ZeroEx.getOrderHashHex(a) === ZeroEx.getOrderHashHex(b)) {
      return 0;
    }
    const priceA = this.getPriceForSignedOrder(a);
    const priceB = this.getPriceForSignedOrder(b);
    const priceDif = priceB.sub(priceA);
    if (!priceDif.isZero()) {
      return priceDif.toNumber();
    }
    return -1;
  };

  // a - b
  private sortOrdersDesc = (a: SignedOrder, b: SignedOrder) => {
    return this.sortOrdersAsc(b, a);
  };

  private getMidMarketPrice = (bids: RBTree<SignedOrder>, asks: RBTree<SignedOrder>): BigNumber => {
    // Bids and asks currently exist
    if (bids && bids.size > 0 && asks && asks.size > 0) {
      const currentHighestBid = bids.max(); // highest 'buy'
      const currentLowestAsk = asks.min(); // lowest 'sell'
      const midMarketPrice = this.getPriceForSignedOrder(currentHighestBid)
        .plus(this.getPriceForSignedOrder(currentLowestAsk))
        .div(2);
      return midMarketPrice;
    }
    // No bids exist, use ask price
    if (asks && asks.size > 0) {
      return this.getPriceForSignedOrder(asks.min());
    }
    // No bids exist, no one is selling, no price right now...
    return new BigNumber(NaN);
  };

  private RBTreeToArray<T>(tree: RBTree<T>): Array<T> {
    let arr: Array<T> = [];
    tree.each(node => arr.push(node));
    return arr;
  }

  render() {
    console.log(this.state);

    const { wsEndpoint, selectedBaseToken, selectedQuoteToken, availableTokenPairs } = this.props;
    const { loading, asks, bids } = this.state;

    const currentTokenPair = availableTokenPairs.find(
      tokenPair =>
        tokenPair.baseToken.address === selectedBaseToken.address &&
        tokenPair.quoteToken.address === selectedQuoteToken.address
    );

    const asksInOrder = this.RBTreeToArray(asks);
    const bidsInOrder = this.RBTreeToArray(bids);
    const midMarketPrice = this.getMidMarketPrice(bids, asks).toFixed(5);

    return (
      <AppContent>
        <ZeroExFeed
          ref={ref => (this.feed = ref)}
          url={wsEndpoint}
          onMessage={this.handleSocketMessage}
          onOrderbookSnapshot={this.handleOrderbookSnapshot}
          onOrderbookUpdate={this.handleOrderbookUpdate}
          onOrderbookFill={this.handleOrderbookFill}
          onClose={() => {}}
        />
        <LeftNavContainer>
          <LeftNavHeader>
            <NavLink to={'/'}>
              <LeftNavHeaderLogo src={logo} />
            </NavLink>
            <NavLink to={'/'}>
              <LeftNavHeaderTitle>Conduit</LeftNavHeaderTitle>
            </NavLink>
          </LeftNavHeader>
          <LeftNavSectionContainer>
            <LeftNavSectionTitle>Token Pairs</LeftNavSectionTitle>
            {availableTokenPairs.map(tokenPair => (
              <LeftNavListItem
                to={`/orderbook/${tokenPair.baseToken.symbol}-${tokenPair.quoteToken.symbol}`}
                title={tokenPair.symbolTicker}
                subtitle={tokenPair.nameTicker}
              />
            ))}
          </LeftNavSectionContainer>
        </LeftNavContainer>
        <OrderbookContainer>
          <OrderbookHeader>
            <OrderbookHeaderTitle>
              {(currentTokenPair && currentTokenPair.nameTicker) ||
                `${selectedBaseToken.name}/${selectedQuoteToken.name}`}
            </OrderbookHeaderTitle>
          </OrderbookHeader>
          <OrderbookContent>
            <ContentPanel>
              <MarketSummary>{midMarketPrice}</MarketSummary>
              <BidsAndAsksTablesContainer>
                <AskTableContainer>
                  <TradeTable
                    headerTitle={'Asks'}
                    baseTokenSymbol={selectedBaseToken.symbol}
                    quoteTokenSymbol={selectedQuoteToken.symbol}
                    data={asksInOrder}
                    loading={loading}
                    noOrdersText={'No asks found'}
                  />
                </AskTableContainer>
                <BidTableContainer>
                  <TradeTable
                    headerTitle={'Bids'}
                    baseTokenSymbol={selectedBaseToken.symbol}
                    quoteTokenSymbol={selectedQuoteToken.symbol}
                    data={bidsInOrder}
                    loading={loading}
                    noOrdersText={'No bids found'}
                  />
                </BidTableContainer>
              </BidsAndAsksTablesContainer>
            </ContentPanel>
            <SidePanel>
              <SidePanelHeader>Recent fills</SidePanelHeader>
              <SidePanelContent>
                <SidePanelListItem>No recent fills</SidePanelListItem>
              </SidePanelContent>
            </SidePanel>
          </OrderbookContent>
        </OrderbookContainer>
      </AppContent>
    );
  }
}

export { TokenPairOrderbook };

// @keyframes highlight {
//   0% {
//     background: red
//   }
//   100% {
//     background: none;
//   }
// }

// #highlight:target {
//   animation: highlight 1s;
// }