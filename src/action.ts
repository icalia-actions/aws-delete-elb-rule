import { info, getInput, setOutput } from "@actions/core";

import {
  deleteLoadBalancerRule,
  DeleteLoadBalancerRuleInput,
} from "./lb-rule-mgmt";

export async function run() {
  const ruleArn = await deleteLoadBalancerRule({
    tags: getInput("tags"),
    actions: getInput("actions"),
    listener: getInput("listener"),
    conditions: getInput("conditions"),
    failIfNoMatch: getInput("fail-if-no-match") == "true",
  } as DeleteLoadBalancerRuleInput);

  if (ruleArn) {
    info(`Deleted Rule ARN: ${ruleArn}`);
    setOutput("rule-arn", ruleArn);
  }

  return 0;
}
