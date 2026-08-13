import { describe, expect, it } from 'vitest';
import { actionRequiresCards, canCreateCard, canDiscardCard, hasConversation } from '../src/client/state-helpers.js';

describe('state helpers', () => {
    it('prevents creating more cards than allowed', () => {
        const state = {
            phase: 'createCards',
            amount: 2,
            created: [{ uuid: 1, creatorId: 1, content: 'one' }, { uuid: 2, creatorId: 1, content: 'two' }],
        } as any;

        expect(canCreateCard(state)).toBe(false);
        expect(actionRequiresCards(state)).toBe(false);
    });

    it('allows discarding only when the player has not discarded yet', () => {
        expect(canDiscardCard({ phase: 'discardCard', discarded: null } as any)).toBe(true);
        expect(canDiscardCard({ phase: 'discardCard', discarded: { uuid: 1, creatorId: 1, content: 'one' } } as any)).toBe(false);
        expect(actionRequiresCards({ phase: 'discardCard', discarded: null } as any)).toBe(true);
    });

    it('detects when a phase includes conversation data', () => {
        expect(hasConversation({ phase: 'playCards', conversation: [], played: null } as any)).toBe(true);
        expect(hasConversation({ phase: 'createCards', amount: 1, created: [] } as any)).toBe(false);
    });
});
