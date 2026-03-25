import { getBigQueryConfig } from "@/app/lib/gcp";

export function getCrmTableFqn(): string {
  const { projectId, dataset, table } = getBigQueryConfig();
  return `\`${projectId}.${dataset}.${table}\``;
}

