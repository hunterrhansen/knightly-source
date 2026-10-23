import { Slot } from 'expo-router';
import type { ModalStackProps } from './modal-stack-types';

/** On the web a modal is a page, as Account is: its screens draw their own
 * header with Back, which closes it. */
export function ModalStack(_props: ModalStackProps) {
  return <Slot />;
}
