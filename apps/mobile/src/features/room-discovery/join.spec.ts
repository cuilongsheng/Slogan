import { beginJoin, updateJoinPassword, updateJoinRules, validRoomPassword } from './join';

describe('join preparation', () => {
  it('keeps only four digits and resets agreement when the password changes', () => {
    const started = beginJoin(null, 'room-a');
    const agreed = updateJoinRules(started, true);
    const changed = updateJoinPassword(agreed, 'a1b23456');
    expect(changed).toEqual({ roomId: 'room-a', password: '1234', rulesAccepted: false });
    expect(validRoomPassword(changed!.password)).toBe(true);
    expect(validRoomPassword('123')).toBe(false);
    expect(validRoomPassword('12a4')).toBe(false);
  });

  it('clears password and agreement when the target room changes or state is restored from an empty provider', () => {
    const previous = updateJoinRules(updateJoinPassword(beginJoin(null, 'room-a'), '1234'), true);
    expect(beginJoin(previous, 'room-b')).toEqual({
      roomId: 'room-b',
      password: '',
      rulesAccepted: false,
    });
    expect(beginJoin(null, 'room-a')).toEqual({
      roomId: 'room-a',
      password: '',
      rulesAccepted: false,
    });
  });

  it('retains an invitation only for the matching room preparation', () => {
    const invited = beginJoin(null, 'room-a', 'invite-a');
    expect(beginJoin(invited, 'room-a', 'invite-a')).toBe(invited);
    expect(beginJoin(invited, 'room-a')).toEqual({ roomId: 'room-a', password: '', rulesAccepted: false });
    expect(beginJoin(invited, 'room-b')).toEqual({ roomId: 'room-b', password: '', rulesAccepted: false });
  });
});
