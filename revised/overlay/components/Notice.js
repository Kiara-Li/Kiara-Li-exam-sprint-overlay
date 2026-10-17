// One look for every message the study screens show.
//
// - A toast says something happened. Plain text in a white pill, no icon:
//   it needs no answer and fades after 3 s.
// - A sheet asks for a choice: a centred title, at most one line under it,
//   the main choice as the primary button and the other as the soft one.
//   Same type sizes as Quizlet's own end-of-round screens.

/** The inside of a toast. */
export function noticeToast(toast) {
  return toast ? `<span>${toast.text}</span>` : '';
}
