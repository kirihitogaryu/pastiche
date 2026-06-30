import { describe, expect, it } from 'vitest';
import { captureCommands } from './capture-commands';

describe('capture command model', () => {
	it('marks implemented commands as active and future commands as disabled', () => {
		expect.assertions(3);

		expect(
			captureCommands.filter((command) => command.enabled).map((command) => command.id)
		).toEqual(['pick', 'tab', 'area', 'batch']);
		expect(
			captureCommands.filter((command) => !command.enabled).map((command) => command.id)
		).toEqual(['visible', 'page', 'drag']);
		expect(captureCommands.every((command) => command.title.length > 0)).toBe(true);
	});
});
