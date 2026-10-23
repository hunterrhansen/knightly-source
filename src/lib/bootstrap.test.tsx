import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { Text } from 'react-native';
import { Button } from '../components/ui/button';
import { Bootstrap } from './bootstrap';

const config = {
  clerk_publishable_key: 'pk_test_Y2xlcmsuZXhhbXBsZS5jb20k',
  contact: null,
};
beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

test('returning launch opens from saved config while refresh is still pending', async () => {
  const view = render(
    <Bootstrap
      value="https://api.example"
      fetcher={async () => new Response(JSON.stringify(config))}
    >
      {(state) => <Text>{state.phase}</Text>}
    </Bootstrap>,
  );
  await screen.findByText('ready');
  await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalled());
  view.unmount();
  const fetcher = jest.fn(() => new Promise<Response>(() => {}));
  render(
    <Bootstrap value="https://api.example" fetcher={fetcher}>
      {(state) => <Text>{state.phase}</Text>}
    </Bootstrap>,
  );
  await screen.findByText('ready');
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test('cached configuration survives a network outage but an invalid server config removes it', async () => {
  const fetcher = jest.fn(async () => new Response(JSON.stringify(config)));
  const props = { value: 'https://api.example', fetcher };
  const view = render(
    <Bootstrap {...props}>{(state) => <Text>{state.phase}</Text>}</Bootstrap>,
  );
  await screen.findByText('ready');
  await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalled());
  view.unmount();
  fetcher.mockRejectedValueOnce(new Error('offline'));
  const offline = render(
    <Bootstrap {...props}>{(state) => <Text>{state.phase}</Text>}</Bootstrap>,
  );
  await screen.findByText('ready');
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  expect(screen.queryByText('error')).toBeNull();
  offline.unmount();
  fetcher.mockResolvedValueOnce(
    new Response(JSON.stringify({ ...config, clerk_publishable_key: null })),
  );
  render(
    <Bootstrap {...props}>{(state) => <Text>{state.phase}</Text>}</Bootstrap>,
  );
  await screen.findByText('error');
  expect(await AsyncStorage.getAllKeys()).toEqual([]);
});

test('changing API origin cannot display configuration from the previous server', async () => {
  const fetcher = jest.fn(async () => new Response(JSON.stringify(config)));
  const view = render(
    <Bootstrap value="https://api.example" fetcher={fetcher}>
      {(state) => <Text>{state.phase}</Text>}
    </Bootstrap>,
  );
  await screen.findByText('ready');
  fetcher.mockImplementation(() => new Promise(() => {}));
  view.rerender(
    <Bootstrap value="https://other.example" fetcher={fetcher}>
      {(state) => <Text>{state.phase}</Text>}
    </Bootstrap>,
  );
  expect(screen.queryByText('ready')).toBeNull();
  await screen.findByText('loading');
});

test('missing config never dispatches and exposes recovery', async () => {
  let requests = 0;
  render(
    <Bootstrap
      value={undefined}
      fetcher={async () => {
        requests++;
        return new Response('{}');
      }}
    >
      {(state) => <Text>{state.phase}</Text>}
    </Bootstrap>,
  );
  await screen.findByText('error');
  expect(requests).toBe(0);
});
test('failed bootstrap retries publicly and validates auth config', async () => {
  let attempts = 0;
  render(
    <Bootstrap
      value="https://api.example"
      fetcher={async () => {
        attempts++;
        return attempts === 1
          ? new Response('bad', { status: 503 })
          : new Response(
              JSON.stringify({
                clerk_publishable_key: 'pk_test_Y2xlcmsuZXhhbXBsZS5jb20k',
                contact: null,
              }),
            );
      }}
    >
      {(state) => (
        <>
          <Text>{state.phase}</Text>
          <Button onPress={state.retry}>Retry</Button>
        </>
      )}
    </Bootstrap>,
  );
  await screen.findByText('error');
  fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByText('ready');
});
