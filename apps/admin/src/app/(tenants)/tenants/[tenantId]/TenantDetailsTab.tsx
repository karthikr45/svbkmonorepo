import { KeyValueField } from "@/components/common";
import { Card } from "@/components/ui";
import { Tenant } from "@/features/tenants/tenantData";

type TenantDetailsTabProps = {
  tenant: Tenant;
};

export default function TenantDetailsTab({ tenant }: TenantDetailsTabProps) {
  return (
    <div className="space-y-6">
      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <KeyValueField label="School Name" value={tenant.schoolName} />
          <KeyValueField label="School Code" value={tenant.schoolCode} />
          <KeyValueField label="Tenant Code" value={tenant.tenantCode} />
          <KeyValueField label="Campus" value={tenant.tenantName} />
        </div>
      </Card>

      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <KeyValueField label="Address" value={tenant.address} />
          <KeyValueField label="City" value={tenant.city} />
          <KeyValueField label="State" value={tenant.state} />
          <KeyValueField label="Country" value={tenant.country} />
        </div>
      </Card>
    </div>
  );
}