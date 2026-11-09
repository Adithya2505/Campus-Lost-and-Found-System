import { requireAdmin } from "@/lib/auth";
import { managedItems } from "@/lib/items";
import {
  Header,
  Badge,
  Notice,
  type SearchParams,
  formatDate,
} from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import { collectItem, receiveItem } from "@/app/actions";
export default async function Manage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireAdmin();
  const items = await managedItems();
  return (
    <>
      <Header user={user} />
      <main className="container">
        <div className="page-heading">
          <span className="eyebrow">SECURITY / ADMIN</span>
          <h1>The security desk.</h1>
          <p>Receive found items and record verified collections in person.</p>
        </div>
        <Notice {...await searchParams} />
        <section className="manage-list">
          {items.map((item) => (
            <article key={item.item_id} className="manage-card">
              <div className="manage-item">
                <img src={`/media/${item.photo_path}`} alt={item.item_name} />
                <div>
                  <span className="eyebrow">
                    ITEM #{item.item_id.toString().padStart(3, "0")}
                  </span>
                  <h2>{item.item_name}</h2>
                  <Badge status={item.status} />
                  <p>{item.description}</p>
                  <small>
                    Found at {item.found_location} ·{" "}
                    {formatDate(item.found_date)}
                  </small>
                  <small>
                    Submitted by {item.submitted_by_name} (
                    {item.submitted_by_college_id})
                  </small>
                </div>
              </div>
              <div className="manage-action">
                {item.status === "awaiting_deposit" ? (
                  <>
                    <h3>Receive at security</h3>
                    <p>
                      Confirm only after the physical item has been deposited.
                    </p>
                    <form action={receiveItem}>
                      <input
                        type="hidden"
                        name="item_id"
                        value={item.item_id}
                      />
                      <SubmitButton>Confirm receipt</SubmitButton>
                    </form>
                  </>
                ) : item.status === "available" ? (
                  <form action={collectItem} className="form-stack compact">
                    <h3>Record collection</h3>
                    <input type="hidden" name="item_id" value={item.item_id} />
                    <label>
                      Claimant name
                      <input name="claimant_name" maxLength={100} required />
                    </label>
                    <label>
                      Claimant college ID
                      <input
                        name="claimant_college_id"
                        maxLength={30}
                        required
                      />
                    </label>
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        name="id_checked"
                        value="yes"
                        required
                      />{" "}
                      I checked their college ID in person.
                    </label>
                    <SubmitButton>Record &amp; hand over</SubmitButton>
                  </form>
                ) : (
                  <>
                    <h3>Collection details</h3>
                    <dl className="collection-facts">
                      <dt>Collected by</dt>
                      <dd>{item.claimant_name}</dd>
                      <dt>College ID</dt>
                      <dd>{item.claimant_college_id}</dd>
                      <dt>Date &amp; time</dt>
                      <dd>{item.collected_at}</dd>
                      <dt>Handed over by</dt>
                      <dd>{item.handed_over_by_name}</dd>
                    </dl>
                    <p className="help-text">
                      Visible only to security / admin.
                    </p>
                  </>
                )}
              </div>
            </article>
          ))}
        </section>
        {!items.length && (
          <p className="empty-state">No items submitted yet.</p>
        )}
      </main>
    </>
  );
}
