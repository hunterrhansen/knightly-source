import { Text } from 'react-native';
import { createStyles } from '../../theme/theme';
import { Button, Card } from '../../ui';

/** A query result as one section reads it: loading, a failed refresh or data. */
export type ProgressResource<T> = {
  data?: T;
  error?: Error | null;
  isFetching?: boolean;
  refetch: () => unknown;
};

/** Loading or a retry for one section, so a failed request never hides the
 * sections that loaded. Renders nothing once the section has data and no
 * error; a failed background refresh keeps the loaded section and offers a
 * retry under it. */
export function SectionState<T>({
  resource,
  name,
  eyebrow,
}: {
  resource: ProgressResource<T>;
  name: string;
  eyebrow: string;
}) {
  const styles = useStyles();
  if (resource.error)
    return (
      <Card eyebrow={eyebrow}>
        <Text accessibilityRole="alert" style={styles.body}>
          {`Couldn’t load ${name}. ${resource.error.message}`}
        </Text>
        <Button
          variant="secondary"
          disabled={resource.isFetching}
          onPress={() => resource.refetch()}
        >{`Retry ${name}`}</Button>
      </Card>
    );
  if (resource.data) return null;
  return (
    <Card eyebrow={eyebrow}>
      <Text style={styles.quiet}>{`Loading ${name}…`}</Text>
    </Card>
  );
}

const useStyles = createStyles((theme) => ({
  body: {
    color: theme.colors.ink,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.body,
  },
  quiet: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.small,
  },
}));
