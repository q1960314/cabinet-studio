/**
 * Keeps the newest chat message in view while the visitor reads the chat.
 *
 * The chat grows with the page instead of scrolling inside a box, and its message box
 * sticks to the bottom of the screen. The runtime still scrolls its own message list,
 * which now has nothing to scroll, so this class scrolls the page instead.
 *
 * It only scrolls when the visitor was already at the end of the chat, or is typing in
 * it. A reply never pulls a visitor away from the page's own forms.
 */
export class ChatFollow {
  /**
   * How far, in pixels, the last message may end below the message box and still count
   * as "at the end of the chat".
   */
  static NEAR = 120;

  /**
   * Start following the chat that the runtime mounted in root.
   *
   * :param root: The element the runtime mounted in, such as #agent-app.
   */
  static start(root) {
    const messages = root ? root.querySelector("#ns-msgs") : null;
    const inputBar = root ? root.querySelector(".ns-inputbar") : null;
    if (!messages || !inputBar) {
      return;
    }
    ChatFollow.messages = messages;
    ChatFollow.inputBar = inputBar;
    ChatFollow.atEnd = ChatFollow.isAtEnd();
    window.addEventListener("scroll", ChatFollow.remember, { passive: true });
    window.addEventListener("resize", ChatFollow.remember);
    // Replies stream in as changing text, so watch text as well as new messages.
    const observer = new MutationObserver(ChatFollow.follow);
    observer.observe(messages, { childList: true, subtree: true, characterData: true });
  }

  /**
   * Note whether the visitor is at the end of the chat. Only the visitor scrolls away
   * from the end, so this runs on every scroll.
   */
  static remember() {
    ChatFollow.atEnd = ChatFollow.isAtEnd();
  }

  /**
   * Tell whether the message box is on screen.
   *
   * :return: True when some of the message box is in the window.
   */
  static barOnScreen() {
    const bar = ChatFollow.inputBar.getBoundingClientRect();
    return bar.top < window.innerHeight && bar.bottom > 0;
  }

  /**
   * Tell how far the last message ends below the top of the message box.
   *
   * :return: The distance in pixels, or a negative number when it ends above it.
   */
  static gap() {
    const end = ChatFollow.messages.getBoundingClientRect().bottom;
    return end - ChatFollow.inputBar.getBoundingClientRect().top;
  }

  /**
   * Tell whether the visitor is reading the end of the chat.
   *
   * :return: True when the message box is on screen and the last message ends near it.
   */
  static isAtEnd() {
    return ChatFollow.barOnScreen() && ChatFollow.gap() < ChatFollow.NEAR;
  }

  /**
   * Scroll the page so the newest message ends just above the message box. This runs
   * when the chat changes, and only when the visitor was at the end or is typing.
   */
  static follow() {
    const typing = ChatFollow.inputBar.contains(document.activeElement);
    if (!ChatFollow.barOnScreen() || !(ChatFollow.atEnd || typing)) {
      return;
    }
    const gap = ChatFollow.gap();
    if (gap > 0) {
      window.scrollBy(0, gap);
    }
    ChatFollow.atEnd = true;
  }
}
