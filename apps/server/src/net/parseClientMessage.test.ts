import { describe, expect, it } from 'vitest';
import { parseClientMessage } from './protocol';

describe('parseClientMessage', () => {
  it('accepts a well-formed Providence message', () => {
    expect(parseClientMessage('{"type":"providence","kind":"reward"}')).toEqual({
      type: 'providence',
      kind: 'reward',
    });
    expect(parseClientMessage('{"type":"providence","kind":"punish"}')).toEqual({
      type: 'providence',
      kind: 'punish',
    });
  });

  it('accepts a well-formed Intervene message and keeps only x/y', () => {
    expect(parseClientMessage('{"type":"intervene","position":{"x":3,"y":7,"z":9}}')).toEqual({
      type: 'intervene',
      position: { x: 3, y: 7 },
    });
  });

  it('accepts a heatmap request', () => {
    expect(parseClientMessage('{"type":"requestHeatmap"}')).toEqual({ type: 'requestHeatmap' });
  });

  it('accepts a transition request', () => {
    expect(parseClientMessage('{"type":"transitionTo","constructId":"track"}')).toEqual({
      type: 'transitionTo',
      constructId: 'track',
    });
    expect(parseClientMessage('{"type":"transitionTo"}')).toBeNull(); // missing id
    expect(parseClientMessage('{"type":"transitionTo","constructId":""}')).toBeNull(); // empty id
  });

  it('rejects malformed JSON', () => {
    expect(parseClientMessage('not json')).toBeNull();
  });

  it('rejects unknown or malformed message shapes', () => {
    expect(parseClientMessage('{"type":"nope"}')).toBeNull();
    expect(parseClientMessage('{"type":"providence","kind":"bribe"}')).toBeNull();
    expect(parseClientMessage('{"type":"intervene","position":{"x":"a","y":1}}')).toBeNull();
    expect(parseClientMessage('{"type":"intervene"}')).toBeNull();
    expect(parseClientMessage('42')).toBeNull();
  });
});
