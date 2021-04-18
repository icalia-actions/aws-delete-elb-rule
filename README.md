# AWS Delete ELB Rule

Deletes an ELB Rule that matches a given parameter

## Usage

You can use `tags` (the best choice), `conditions` and/or `actions` for the
action to match the rule you want to delete:

```yaml
      - name: Delete AWS ELB Rule
        uses: icalia-actions/aws-delete-elb-rule@v0.0.1
        with:
          listener: arn:YOUR_LISTENER_ARN
          
          # You can define the tags using JSON or YAML:
          tags: |
            - Key: app
              Value: my-app
            - Key: environment
              Value: development
            - Key: pull-request-node-id
              Value: A_NODE_ID_FROM_GITHUB
```

### Using template files instead:

You can also use an optional json or yaml files for `conditions`, `actions` and
`tags` like this:

```yaml
# tmp/example-conditions.yml
- Field: host-header
  HostHeaderConfig:
    Values:
      - subdomain1.your-domain.tld
      - subdomain2.your-domain.tld
```

```yaml
# tmp/example-actions.yml
- Type: forward
  TargetGroupArn: arn:YOUR_TARGET_GROUP_ARN
```

```yaml
      - name: Delete AWS ELB Rule
        uses: icalia-actions/aws-delete-elb-rule@v0.0.1
        with:
          listener: arn:YOUR_LISTENER_ARN
          conditions: tmp/example.yml
          actions: tmp/example-actions.yml
```

See [icalia-actions/aws-configure-elb-rule](https://github.com/icalia-actions/aws-configure-elb-rule) to see how to create a rule
