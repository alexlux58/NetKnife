# ------------------------------------------------------------------------------
# SHARED LAMBDA LAYER (netknife-common)
# ------------------------------------------------------------------------------
# HTTP response helpers and DynamoDB cache read/write used by PoC functions.
# Source: backend/shared/netknife-common (copied by prepare-lambda-shared.sh).

data "archive_file" "lambda_common_layer" {
  type        = "zip"
  source_dir  = "${path.module}/../../../backend/layer"
  output_path = "${path.module}/lambda-common-layer.zip"

  depends_on = [var.lambda_deps_trigger]
}

resource "aws_lambda_layer_version" "common" {
  layer_name          = "${local.name}-common"
  description         = "NetKnife shared HTTP + DynamoDB cache helpers"
  filename            = data.archive_file.lambda_common_layer.output_path
  source_code_hash    = data.archive_file.lambda_common_layer.output_base64sha256
  compatible_runtimes = ["nodejs20.x"]
}
