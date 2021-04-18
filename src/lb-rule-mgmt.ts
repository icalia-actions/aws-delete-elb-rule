import * as fs from "fs";
import * as util from "util";
import { parse as parseYaml } from "yaml";

import ELBv2, {
  Rule,
  Rules,
  Marker,
  Actions,
  TagList,
  RuleArn,
  RuleArns,
  ResourceArns,
  DescribeTagsInput,
  RuleConditionList,
  DescribeRulesInput,
} from "aws-sdk/clients/elbv2";

export interface DeleteLoadBalancerRuleInput {
  tags?: string;
  actions?: string;
  ruleArn?: string;
  listener?: string;
  conditions?: string;
  failIfNoMatch: boolean;
}

function getClient(): ELBv2 {
  return new ELBv2({
    customUserAgent: "icalia-actions/aws-action",
    region: process.env.AWS_DEFAULT_REGION,
  });
}

function parseData(data: string): any {
  // parseYaml takes care of both YAML and JSON strings
  return parseYaml(data || "null");
}

function readData(filePath: string): any {
  const contents = fs.readFileSync(filePath, "utf8");
  return parseData(contents);
}

function processData(data: string): any {
  if (!data) return;
  if (fs.existsSync(data)) return readData(data);
  return parseData(data);
}

function processConditions(conditions: string): RuleConditionList {
  return processData(conditions) as RuleConditionList;
}

function processActions(actions: string): Actions {
  return processData(actions) as Actions;
}

function processTags(tags: string): TagList {
  return processData(tags) as TagList;
}

function validateInputs(inputs: DeleteLoadBalancerRuleInput): void {
  const { ruleArn, listener, tags, conditions, actions } = inputs;
  if (ruleArn) return;
  if (!listener) throw "You must specify either a rule-arn or a listener-arn";
  if (!tags && !conditions && !actions) {
    throw "You must provide at least one of the following inputs: conditions, actions, or tags";
  }
}

function reactToNoMatchedRule(failIfNoMatch: boolean): undefined {
  const message = "No matching rule found with the given inputs...";
  if (failIfNoMatch) throw message;

  return;
}

async function getRuleArnsMatchingTags(
  rules: Rules,
  tags: TagList
): Promise<RuleArns> {
  const client = getClient();

  const { TagDescriptions: descriptions } = await client
    .describeTags({
      ResourceArns: rules.map((rule) => rule.RuleArn) as ResourceArns,
    } as DescribeTagsInput)
    .promise();

  let matchingRuleArns = [] as RuleArns;

  return (descriptions || [])
    .map((description) => {
      const { ResourceArn: ruleArn, Tags: ruleTags } = description;
      const match = (ruleTags || [])
        .map((ruleTag) => {
          return tags
            .map((tag) => util.isDeepStrictEqual(ruleTag, tag))
            .reduce((accum, curr) => accum || curr, false);
        })
        .reduce((accum, curr) => accum && curr, (ruleTags || []).length > 0);
      return { ruleArn, match };
    })
    .reduce((accum, curr) => {
      if (curr.ruleArn && curr.match) accum.push(curr.ruleArn);
      return accum;
    }, matchingRuleArns);
}

function compareConditions(rule: Rule, conditions: RuleConditionList): boolean {
  const { Conditions: currentConditions } = rule;
  const conditionsToMatch = conditions.map((condition) => {
    const Values = condition.HostHeaderConfig?.Values;
    return { Values, ...condition };
  });

  return util.isDeepStrictEqual(currentConditions, conditionsToMatch);
}

async function findMatchingRule(
  inputs: DeleteLoadBalancerRuleInput
): Promise<Rule | undefined> {
  const params = { ListenerArn: inputs.listener } as DescribeRulesInput;

  let tags = [] as TagList,
    Rules: Rules | undefined,
    conditions: RuleConditionList,
    NextMarker: Marker | undefined,
    matchingRule: Rule | undefined;

  const client = getClient();
  if (inputs.conditions) conditions = processConditions(inputs.conditions);

  if (inputs.tags) tags = processTags(inputs.tags);
  const compareTags = tags.length > 1;

  do {
    ({ Rules, NextMarker } = await client.describeRules(params).promise());

    let arnsMatchingTags = [] as RuleArns;
    if (Rules && compareTags)
      arnsMatchingTags = await getRuleArnsMatchingTags(Rules, tags);

    matchingRule = (Rules || []).find((rule) => {
      let matches = [];
      if (compareTags && rule.RuleArn)
        matches.push(arnsMatchingTags.includes(rule.RuleArn));
      // if (actions) matches.push(compareActions(rule, actions))
      if (conditions) matches.push(compareConditions(rule, conditions));
      return matches.reduce((accum, current) => accum && current, true);
    });
  } while (NextMarker && !matchingRule);

  return matchingRule;
}

export async function deleteLoadBalancerRule(
  inputs: DeleteLoadBalancerRuleInput
): Promise<RuleArn | undefined> {
  validateInputs(inputs);

  let { ruleArn, failIfNoMatch } = inputs;

  if (!ruleArn) {
    const matchingRule = await findMatchingRule(inputs);
    if (matchingRule) ruleArn = matchingRule.RuleArn;
  }

  if (!ruleArn) return reactToNoMatchedRule(failIfNoMatch);

  await getClient().deleteRule({ RuleArn: ruleArn }).promise();

  return ruleArn;
}
