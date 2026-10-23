import { Component, type PropsWithChildren } from 'react';
import { Body } from '../../ui';

/** A renderer failure must not hide the account's other progress sections. */
export class ChartPanel extends Component<
  PropsWithChildren,
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    if (this.state.failed)
      return (
        <Body>
          The chart could not load. Your progress summaries are still available.
          Reload the app to try the chart again.
        </Body>
      );
    return this.props.children;
  }
}
