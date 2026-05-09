import type { Metadata } from "next";
import { ViewMediaPageContainer } from "./ViewMediaPageContainer";

export const metadata: Metadata = {
  title: "Media",
  description: "Manage media",
};

export default function MediaPage() {
  return (
    <div>
      <ViewMediaPageContainer />
    </div>
  );
}
