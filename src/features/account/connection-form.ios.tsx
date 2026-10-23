import { Picker, Text } from '@expo/ui/swift-ui';
import {
  disabled as disable,
  listRowBackground,
  pickerStyle,
  tag,
} from '@expo/ui/swift-ui/modifiers';
import { useTheme } from '../../theme/theme';
import {
  NativeSettingsActionRow,
  NativeSettingsRow,
  NativeSettingsSection,
  NativeSettingsTextFieldRow,
} from '../../ui/native-settings';
import {
  type ConnectionFormProps,
  useConnectionForm,
} from './use-connection-form';
export function ConnectionForm(props: ConnectionFormProps) {
  const { theme } = useTheme();
  const {
    source,
    setSource,
    handle,
    setHandle,
    submitted,
    setSubmitted,
    message,
    setMessage,
    busy,
    lookup,
    confirm,
    findAccount,
  } = useConnectionForm(props);
  const unavailable = props.disabled || busy;
  return (
    <>
      <NativeSettingsSection
        title="Connect an account"
        footer="Connect public games. Knightly never asks for your chess-site password."
      >
        <Picker
          label="Game site"
          selection={source}
          onSelectionChange={(value) => {
            setSource(value);
            setSubmitted('');
            setMessage('');
          }}
          modifiers={[
            pickerStyle('segmented'),
            disable(unavailable),
            listRowBackground(theme.colors.surface),
          ]}
        >
          <Text modifiers={[tag('chesscom')]}>Chess.com</Text>
          <Text modifiers={[tag('lichess')]}>Lichess</Text>
        </Picker>
        <NativeSettingsTextFieldRow
          label="Game account username"
          placeholder="Username"
          value={handle}
          onChange={(value) => {
            setHandle(value);
            setSubmitted('');
            setMessage('');
          }}
          contentType="username"
          disabled={unavailable}
          onSubmit={findAccount}
          search
        />
        <NativeSettingsActionRow
          label={lookup.isFetching ? 'Finding account…' : 'Find account'}
          disabled={unavailable || lookup.isFetching}
          onPress={findAccount}
        />
        {(message || lookup.error?.message) && (
          <NativeSettingsRow
            label="Could not connect"
            description={message || lookup.error?.message}
          />
        )}
      </NativeSettingsSection>
      {lookup.data && submitted && (
        <NativeSettingsSection
          title={`Connect ${lookup.data.handle}?`}
          footer="Confirming imports this account’s public games."
        >
          <NativeSettingsRow
            label={lookup.data.handle}
            description={`${source === 'chesscom' ? 'Chess.com' : 'Lichess'} · ${lookup.data.games.toLocaleString()} public games`}
          />
          <NativeSettingsActionRow
            label="Confirm connection"
            disabled={unavailable || lookup.isFetching}
            onPress={() => void confirm()}
          />
          <NativeSettingsActionRow
            label="Cancel"
            disabled={busy}
            onPress={() => setSubmitted('')}
          />
        </NativeSettingsSection>
      )}
    </>
  );
}
