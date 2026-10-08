// Home and weekly rows disclose scheduling in More; Today/Backlog keep inline controls.
export async function revealPlanningActions(page, title) {
  const more = page.getByLabel(`More planning actions for ${title}`, { exact: true });
  if (await more.count() && await more.getAttribute("aria-expanded") !== "true") await more.click();
}
