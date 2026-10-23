import { parseReturnRoute } from '../../lib/auth/return-route';
import { settingsSectionTitles } from './settings-sections';

test.each(Object.keys(settingsSectionTitles))(
  'reloading the %s settings section returns to it after sign-in',
  (section) => {
    const route = `/account-settings?section=${section}`;
    expect(parseReturnRoute(route)).toBe(route);
  },
);
