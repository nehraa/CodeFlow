const TS_JS_QUERIES = {
    functions: `
    (function_declaration
      name: (identifier) @name
      parameters: (formal_parameters) @params
      return_type: (type_annotation)? @returnType
      body: (statement_block) @body) @func
    (generator_function_declaration
      name: (identifier) @name
      parameters: (formal_parameters) @params
      return_type: (type_annotation)? @returnType
      body: (statement_block) @body) @func
  `,
    classes: `
    (class_declaration
      name: (type_identifier) @name
      heritage: (class_heritage
        (identifier) @parent)?) @class
    (class_declaration
      name: (type_identifier) @name) @class
  `,
    methods: `
    (method_definition
      name: (property_identifier) @name
      parameters: (formal_parameters) @params
      return_type: (type_annotation)? @returnType
      body: (statement_block) @body) @method
  `,
    imports: `
    (import_statement
      source: (string) @source) @import
    (import_require_clause
      source: (string) @source) @import
  `,
    calls: `
    (call_expression
      function: (identifier) @callee) @call
    (call_expression
      function: (member_expression
        property: (property_identifier) @callee)) @call
  `,
    inherits: `
    (class_heritage
      (identifier) @parent) @inherits
  `
};
const GO_QUERIES = {
    functions: `
    (function_declaration
      name: (identifier) @name
      parameters: (parameter_list) @params
      result: (_) @returnType?
      body: (block) @body) @func
    (method_declaration
      receiver: (parameter_list) @receiver
      name: (field_identifier) @name
      parameters: (parameter_list) @params
      result: (_) @returnType?
      body: (block) @body) @func
  `,
    classes: `
    (type_declaration
      declarator: (type_identifier) @name
      type: (struct_type)) @class
  `,
    methods: `
    (method_declaration
      receiver: (parameter_list
        (parameter_declaration
          name: (identifier)? @receiverName
          type: (_) @receiverType))
      name: (field_identifier) @name
      parameters: (parameter_list) @params
      result: (_) @returnType?
      body: (block) @body) @method
  `,
    imports: `
    (import_declaration
      (import_spec_list
        (import_spec
          path: (interpreted_string_literal) @source))) @import
    (import_declaration
      (import_spec
        path: (interpreted_string_literal) @source)) @import
  `,
    calls: `
    (call_expression
      function: (identifier) @callee) @call
    (call_expression
      function: (selector_expression
        field: (field_identifier) @callee)) @call
    (call_expression
      function: (qualified_identifier
        name: (field_identifier) @callee)) @call
  `,
    inherits: `
    (type_spec
      type: (struct_type
        (field_declaration
          name: (field_identifier) @parent
          type: (type_identifier)))) @inherits
  `
};
const PYTHON_QUERIES = {
    functions: `
    (function_definition
      name: (identifier) @name
      parameters: (parameters) @params
      return_type: (type)? @returnType
      body: (block) @body) @func
  `,
    classes: `
    (class_definition
      name: (identifier) @name
      superclasses: (argument_list
        (identifier) @parent)?) @class
    (class_definition
      name: (identifier) @name) @class
  `,
    methods: `
    (function_definition
      name: (identifier) @name
      parameters: (parameters) @params
      return_type: (type)? @returnType
      body: (block) @body) @method
  `,
    imports: `
    (import_statement
      name: (dotted_name) @source) @import
    (import_from_statement
      module_name: (dotted_name) @source) @import
  `,
    calls: `
    (call
      function: (identifier) @callee) @call
    (call
      function: (attribute
        attribute: (identifier) @callee)) @call
  `,
    inherits: `
    (argument_list
      (identifier) @parent) @inherits
  `
};
const C_QUERIES = {
    functions: `
    (function_definition
      declarator: (function_declarator
        declarator: (identifier) @name
        parameters: (parameter_list) @params)
      body: (compound_statement) @body) @func
  `,
    classes: ``,
    methods: ``,
    imports: `
    (preproc_include
      path: (system_lib_string) @source) @import
    (preproc_include
      path: (string_literal) @source) @import
  `,
    calls: `
    (call_expression
      function: (identifier) @callee) @call
  `,
    inherits: ``
};
const CPP_QUERIES = {
    functions: `
    (function_definition
      declarator: (function_declarator
        declarator: (identifier) @name
        parameters: (parameter_list) @params)
      body: (compound_statement) @body) @func
    (function_definition
      declarator: (function_declarator
        declarator: (field_identifier) @name
        parameters: (parameter_list) @params)
      body: (compound_statement) @body) @func
  `,
    classes: `
    (class_specifier
      name: (type_identifier) @name
      (base_class_clause
        type: (type_identifier) @parent)?) @class
    (class_specifier
      name: (type_identifier) @name) @class
    (struct_specifier
      name: (type_identifier) @name
      (base_class_clause
        type: (type_identifier) @parent)?) @class
    (struct_specifier
      name: (type_identifier) @name) @class
  `,
    methods: `
    (function_definition
      declarator: (function_declarator
        declarator: (field_identifier) @name
        parameters: (parameter_list) @params)
      body: (compound_statement) @body) @method
  `,
    imports: `
    (preproc_include
      path: (system_lib_string) @source) @import
    (preproc_include
      path: (string_literal) @source) @import
    (import_declaration
      (import_module) @source) @import
  `,
    calls: `
    (call_expression
      function: (identifier) @callee) @call
    (call_expression
      function: (field_expression
        field: (field_identifier) @callee)) @call
  `,
    inherits: `
    (base_class_clause
      type: (type_identifier) @parent) @inherits
  `
};
const RUST_QUERIES = {
    functions: `
    (function_item
      name: (identifier) @name
      parameters: (parameters) @params
      return_type: (type_identifier)? @returnType
      body: (block) @body) @func
  `,
    classes: `
    (struct_item
      name: (type_identifier) @name) @class
    (enum_item
      name: (type_identifier) @name) @class
    (trait_item
      name: (type_identifier) @name) @class
    (impl_item
      type: (type_identifier) @name
      trait: (type_identifier)? @trait) @class
  `,
    methods: `
    (function_item
      name: (identifier) @name
      parameters: (parameters
        (self_parameter))? @self
      return_type: (type_identifier)? @returnType
      body: (block) @body) @method
  `,
    imports: `
    (use_declaration
      argument: (scoped_identifier
        path: (identifier) @source)) @import
    (use_declaration
      argument: (scoped_identifier
        (scoped_identifier
          path: (identifier) @source))) @import
    (use_declaration
      argument: (identifier) @source) @import
    (use_declaration
      argument: (use_as_clause
        path: (_) @source)) @import
  `,
    calls: `
    (call_expression
      function: (identifier) @callee) @call
    (call_expression
      function: (scoped_identifier
        name: (identifier) @callee)) @call
    (call_expression
      function: (field_expression
        field: (field_identifier) @callee)) @call
  `,
    inherits: `
    (trait_bounds
      (type_identifier) @parent) @inherits
  `
};
export const QUERIES_BY_LANGUAGE = {
    typescript: TS_JS_QUERIES,
    javascript: TS_JS_QUERIES,
    go: GO_QUERIES,
    python: PYTHON_QUERIES,
    c: C_QUERIES,
    cpp: CPP_QUERIES,
    rust: RUST_QUERIES
};
